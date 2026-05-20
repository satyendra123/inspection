import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MAX_FIELD_LENGTH = 25000;
const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastCleanupAt = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "..", "logs", "api-audit");
const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "oldpassword",
  "confirm_password",
  "token",
  "authorization",
  "access_token",
  "refresh_token",
  "secret",
  "otp",
  "pin",
]);

const trimString = (value, max = MAX_FIELD_LENGTH) => {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  if (!input) return null;
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...[truncated]`;
};

const safeSerialize = (value, max = MAX_FIELD_LENGTH) => {
  if (value === undefined) return null;
  try {
    return trimString(JSON.stringify(value), max);
  } catch {
    return trimString(String(value), max);
  }
};

const maskSensitive = (value, seen = new WeakSet(), depth = 0) => {
  if (value == null) return value;
  if (depth > 8) return "[max_depth]";
  if (typeof value === "function") return "[function]";
  if (typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.map((x) => maskSensitive(x, seen, depth + 1));

  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const lowered = String(key).toLowerCase().replace(/[^a-z_]/g, "");
      out[key] = SENSITIVE_KEYS.has(lowered) ? "***masked***" : maskSensitive(val, seen, depth + 1);
    }
    return out;
  }

  return value;
};

const pickHeaders = (headers) => {
  const selected = {
    authorization: headers.authorization || headers.Authorization || null,
    "content-type": headers["content-type"] || null,
    "x-device-id": headers["x-device-id"] || null,
    "x-platform": headers["x-platform"] || null,
    "x-app-version": headers["x-app-version"] || null,
    "user-agent": headers["user-agent"] || null,
  };

  return maskSensitive(selected);
};

const detectDeviceType = (req) => {
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const hint = String(req.headers["x-device-type"] || "").toLowerCase();

  if (hint) return hint;
  if (ua.includes("android") || ua.includes("iphone") || ua.includes("mobile")) return "mobile";
  if (ua.includes("postman")) return "postman";
  if (ua.includes("insomnia")) return "insomnia";
  if (ua.includes("mozilla")) return "browser";
  return "unknown";
};

const pickFilesSummary = (files) => {
  if (!files) return null;

  const normalizeFile = (f) => ({
    fieldname: f.fieldname,
    originalname: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    filename: f.filename,
  });

  if (Array.isArray(files)) return files.map(normalizeFile);

  if (typeof files === "object") {
    const out = {};
    for (const [field, value] of Object.entries(files)) {
      out[field] = Array.isArray(value) ? value.map(normalizeFile) : [];
    }
    return out;
  }

  return null;
};

const ensureLogDirectory = async () => {
  await fs.mkdir(LOG_DIR, { recursive: true });
};

const getDailyLogFilePath = (value = new Date()) => {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `api-audit-${yyyy}-${mm}-${dd}.log`);
};

const deleteOldLogFiles = async () => {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  try {
    await ensureLogDirectory();
    const files = await fs.readdir(LOG_DIR);
    const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    await Promise.all(
      files.map(async (file) => {
        const match = /^api-audit-(\d{4})-(\d{2})-(\d{2})\.log$/.exec(file);
        if (!match) return;

        const [_, y, m, d] = match;
        const logDate = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
        if (Number.isNaN(logDate)) return;

        if (logDate < cutoff) {
          await fs.unlink(path.join(LOG_DIR, file));
        }
      })
    );
  } catch (err) {
    console.error("apiAuditLogger cleanup failed:", err?.message || err);
  }
};

const apiAuditLogger = (req, res, next) => {
  const startedAt = Date.now();
  let capturedResponse = null;
  let capturedError = null;

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    capturedResponse = body;
    return originalJson(body);
  };

  res.send = (body) => {
    if (capturedResponse === null) {
      if (Buffer.isBuffer(body)) capturedResponse = "[buffer]";
      else capturedResponse = body;
    }
    return originalSend(body);
  };

  res.on("finish", async () => {
    try {
      await ensureLogDirectory();
      await deleteOldLogFiles();

      const requestPayload = {
        body: maskSensitive(req.body || {}),
        files: pickFilesSummary(req.files),
      };

      const responsePayload = maskSensitive(capturedResponse);
      if (res.statusCode >= 500 && responsePayload == null) {
        capturedError = "Internal server error";
      }

      const logRecord = {
        timestamp: new Date().toISOString(),
        method: req.method,
        endpoint: req.originalUrl || req.url,
        path: req.path || req.url,
        status_code: res.statusCode,
        duration_ms: Date.now() - startedAt,
        ip_address: req.ip || req.socket?.remoteAddress || null,
        user_id: req.user?.id ?? null,
        device_type: detectDeviceType(req),
        device_id:
          req.headers["x-device-id"] ||
          req.headers["device-id"] ||
          req.headers["x-client-id"] ||
          null,
        platform: req.headers["x-platform"] || null,
        user_agent: trimString(req.headers["user-agent"] || "", 1000),
        request_headers: maskSensitive(pickHeaders(req.headers)),
        request_params: maskSensitive(req.params || {}),
        request_query: maskSensitive(req.query || {}),
        request_payload: maskSensitive(requestPayload),
        response_payload: responsePayload,
        error_message: capturedError,
      };

      const line = `${safeSerialize(logRecord)}\n`;
      const filePath = getDailyLogFilePath(new Date());
      await fs.appendFile(filePath, line, "utf8");
    } catch (err) {
      console.error("apiAuditLogger failed:", err?.message || err);
    }
  });

  next();
};

export default apiAuditLogger;

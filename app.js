import dotenv from "dotenv";
import sequelize from "./config/connectiondb.js";
import express from "express";
import Routes from "./Router/Routes.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mime from "mime-types";
import apiAuditLogger from "./middleware/apiAuditLogger.js";
import { ensureRequiredPermissions } from "./utils/requiredPermissions.js";
import { ensureSchemaCompatibility } from "./utils/schemaCompatibility.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8060;
const isTestEnv = process.env.NODE_ENV === "test";
const dbSyncMode = process.env.DB_SYNC_MODE || "safe";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/api", apiAuditLogger);

app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "1d",
  immutable: true,
  setHeaders: (res, filePath) => {
    const contentType = mime.lookup(filePath) || "application/octet-stream";
    if (contentType.startsWith("image/") || contentType === "application/pdf") {
      res.setHeader("Content-Disposition", "inline");
    }
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  },
}));

app.get("/api/uploads/:type/:file", (req, res) => {
  const { type, file } = req.params;
  const filePath = path.join(__dirname, "uploads", type, file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  const contentType = mime.lookup(filePath) || "application/octet-stream";

  if (contentType.startsWith("image/") || contentType === "application/pdf") {
    res.setHeader("Content-Disposition", "inline");
  } else {
    res.setHeader("Content-Disposition", "attachment");
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.sendFile(filePath);
});

app.use("/api", Routes);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.warn(
      "Invalid JSON payload:",
      req.method,
      req.originalUrl || req.url,
      "-",
      err.message
    );
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }

  return next(err);
});

if (!isTestEnv) {
  const syncOptions =
    dbSyncMode === "alter"
      ? { alter: true }
      : dbSyncMode === "force"
        ? { force: true }
        : {};

  sequelize
    .authenticate()
    .then(() => {
      console.log("Database connected successfully.");
      return sequelize.sync(syncOptions);
    })
    .then(async () => {
      console.log(`Tables synced (mode: ${dbSyncMode}).`);
      await ensureSchemaCompatibility(sequelize);
      const createdPermissions = await ensureRequiredPermissions();
      if (createdPermissions.length) {
        console.log(
          `Inserted missing permissions (${createdPermissions.length}): ${createdPermissions.join(", ")}`,
        );
      }
    })
    .catch((err) => console.error("DB connection error:", err));

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export default app;

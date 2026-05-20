import { Inspection, Category, Unit, User, InspectionAssignment, InspectionAssignmentItem, InspectionCase, InspectionBatch, PurchaseOrderItem, Vendor, Test, Items, InspectionItem, PoStage, PurchaseOrder, Stage, StageTest, InspectionEvent, Company } from "../Model/index.js";
import { Sequelize, where } from "sequelize";
const { Op } = Sequelize;
import crypto from "crypto";
import { logInspectionEvent } from "../utils/logInspectionEvent.js";

const normalizePublicBaseUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "").replace(/\/api$/i, "");

const normalizeReportAssetPath = (value = "") => {
  const normalized = `/${String(value || "").trim().replace(/^\/+/, "")}`;
  if (/^\/api\/uploads\//i.test(normalized)) return normalized;
  if (/^\/uploads\//i.test(normalized)) return `/api${normalized}`;
  return normalized;
};

const toPublicUrl = (value, baseUrl = "") => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      parsed.pathname = normalizeReportAssetPath(parsed.pathname);
      return parsed.toString();
    } catch {
      return raw;
    }
  }

  const normalizedPath = normalizeReportAssetPath(raw);
  const base = normalizePublicBaseUrl(baseUrl || process.env.APP_URL || "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
};

const normalizeDocuments = (documents, baseUrl = "") => {
  if (!documents) return [];

  let values = documents;
  if (typeof values === "string") {
    try {
      values = JSON.parse(values);
    } catch {
      values = [values];
    }
  }

  if (!Array.isArray(values)) values = [values];

  return values
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") return toPublicUrl(entry, baseUrl);
      if (typeof entry === "object") {
        const urlValue = entry.url ?? entry.path ?? entry.file ?? entry.location ?? null;
        return toPublicUrl(urlValue, baseUrl);
      }
      return null;
    })
    .filter(Boolean);
};

const getPublicBaseUrl = (req) => {
  const envBase = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (envBase) return envBase;

  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || String(req?.protocol || "http").trim() || "http";
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(req?.get?.("host") || "").trim();
  return host ? `${protocol}://${host}` : "";
};

const normalizeStageStatus = (value) => {
  if (!value) return "pending";
  const v = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "inprogress") return "in_progress";
  if (v === "rejected" || v === "reject") return "failed";
  if (v === "rework") return "failed";
  return v;
};

const normalizeStageResult = (value) => {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "rejected" || v === "reject") return "fail";
  if (v === "rework" || v === "failed") return "fail";
  if (v === "pass" || v === "fail") return v;
  return null;
};

const pickItemName = (source) => {
  return (
    source?.PoItem?.Item?.item_name ||
    source?.PoItem?.Items?.item_name ||
    source?.purchase_order_item?.Item?.item_name ||
    source?.purchase_order_item?.Items?.item_name ||
    source?.PurchaseOrderItem?.Item?.item_name ||
    source?.PurchaseOrderItem?.Items?.item_name ||
    null
  );
};

const toYmd = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatMissedDate = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toDayStart = (ymd) => {
  if (!ymd) return null;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDayEndExclusive = (ymd) => {
  const start = toDayStart(ymd);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
};

const normalizeReportStageStatus = (value) => {
  if (!value) return "pending";
  const v = String(value).trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (v === "inprogress") return "in_progress";
  if (v === "rejected" || v === "reject" || v === "failed") return "failed";
  if (v === "rework") return "rework";
  if (v === "completed") return "completed";
  if (v === "pending") return "pending";
  return v;
};

const deriveReportTestStatus = (rows, passQty) => {
  if (!Array.isArray(rows) || rows.length === 0) return "pending";
  const latest = rows[rows.length - 1] || null;
  const latestResult = String(latest?.result || "").trim().toLowerCase();
  const latestStatus = String(latest?.status || "").trim().toLowerCase();

  if (latestResult === "fail" || latestResult === "reject") return "failed";
  if (latestStatus === "rework") return "rework";
  if (passQty > 0 || latestResult === "pass") return "completed";
  return "in_progress";
};

const mapStageTestExecution = (row) => {
  const rawResult = String(row?.result || "").trim().toLowerCase();
  const normalizedStatus = normalizeReportStageStatus(row?.status);
  const quantity = Math.max(Number(row?.quantity || 0), 0);

  let status = "in_progress";
  let result = normalizeStageResult(row?.result) || null;
  let pass_quantity = 0;
  let fail_quantity = 0;

  if (rawResult === "fail" || rawResult === "reject" || normalizedStatus === "failed") {
    status = "failed";
    result = "fail";
    fail_quantity = quantity;
  } else if (normalizedStatus === "rework" || rawResult === "rework") {
    status = "rework";
    result = rawResult === "pass" ? "pass" : "fail";
    pass_quantity = rawResult === "pass" ? quantity : 0;
    fail_quantity = quantity;
  } else if (rawResult === "pass" || normalizedStatus === "completed") {
    status = "completed";
    result = "pass";
    pass_quantity = quantity;
  } else if (normalizedStatus === "pending") {
    status = "pending";
  }

  return {
    status,
    result,
    quantity,
    pass_quantity,
    fail_quantity,
  };
};

const REPORT_STATUS_ORDER = [
  "assigned",
  "in_progress",
  "completed",
  "rejected",
  "failed",
  "rework",
  "rescheduled",
  "cancelled",
];

const REPORT_ASSIGNMENT_STATUSES = ["active", "assigned", "in_process", "rescheduled", "completed"];

const normalizeStatusFilter = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (normalized === "active") return "assigned";
  if (normalized === "inprogress") return "in_progress";
  if (normalized === "reject") return "rejected";
  return normalized;
};

const sortUniqueStatuses = (values) =>
  [...new Set((values || []).map(normalizeStatusFilter).filter(Boolean))]
    .sort((left, right) => {
      const leftIndex = REPORT_STATUS_ORDER.indexOf(left);
      const rightIndex = REPORT_STATUS_ORDER.indexOf(right);
      const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      if (normalizedLeftIndex !== normalizedRightIndex) {
        return normalizedLeftIndex - normalizedRightIndex;
      }
      return left.localeCompare(right);
    });

const toValidTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const dedupeTextJoin = (values) => {
  const unique = [];
  const seen = new Set();
  for (const raw of values || []) {
    const v = String(raw || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    unique.push(v);
  }
  return unique.join(" | ");
};

const pickLastNonEmptyValue = (values) => {
  let resolved = null;
  for (const raw of values || []) {
    const value = String(raw || "").trim();
    if (value) {
      resolved = value;
    }
  }
  return resolved;
};

const normalizeNullableText = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const toValidDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const pickFirstValidDate = (values) => {
  for (const raw of values || []) {
    const parsed = toValidDate(raw);
    if (parsed) {
      return parsed;
    }
  }
  return null;
};

const pickLastValidDate = (values) => {
  let resolved = null;
  for (const raw of values || []) {
    const parsed = toValidDate(raw);
    if (parsed && (!resolved || parsed.getTime() > resolved.getTime())) {
      resolved = parsed;
    }
  }
  return resolved;
};

const resolveStageTestReportedOn = (row) =>
  pickLastValidDate([row?.updatedAt]) || null;

const resolveLatestStageTestReportedOn = (rows) =>
  pickLastValidDate((rows || []).map((row) => row?.updatedAt)) || null;

const calculateDurationDays = (startValue, endValue) => {
  const start = toValidDate(startValue);
  const end = toValidDate(endValue);
  if (!start || !end) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.max(1, Math.floor(diffMs / 86400000) + 1);
};

const matchesTextFilter = (value, filterValue) => {
  const filter = String(filterValue || "").trim().toLowerCase();
  if (!filter) return true;
  const source = String(value || "").trim().toLowerCase();
  return source.includes(filter);
};

const hasDateChanged = (currentValue, nextValue) => {
  const currentDate = toValidDate(currentValue);
  const nextDate = toValidDate(nextValue);
  if (!currentDate && !nextDate) return false;
  if (!currentDate || !nextDate) return true;
  return currentDate.getTime() !== nextDate.getTime();
};

const buildInspectionReschedulePayload = ({
  inspection,
  nextScheduleDate,
  reason,
  inspectorId,
  assignmentId,
}) => {
  const payload = {};

  if (String(inspection.status || "").trim().toLowerCase() !== "rescheduled") {
    payload.status = "rescheduled";
  }

  if (hasDateChanged(inspection.schedule_datetime, nextScheduleDate)) {
    payload.schedule_datetime = nextScheduleDate;
  }

  const currentRemarks = normalizeNullableText(inspection.remarks);
  const nextRemarks = normalizeNullableText(reason ?? inspection.remarks);
  if (currentRemarks !== nextRemarks) {
    payload.remarks = nextRemarks;
  }

  if (
    inspectorId !== undefined &&
    inspectorId !== null &&
    Number(inspection.inspector_id || 0) !== Number(inspectorId || 0)
  ) {
    payload.inspector_id = Number(inspectorId);
  }

  if (
    assignmentId !== undefined &&
    assignmentId !== null &&
    Number(inspection.assignment_id || 0) !== Number(assignmentId || 0)
  ) {
    payload.assignment_id = Number(assignmentId);
  }

  return payload;
};

const buildAssignmentReschedulePayload = ({
  assignment,
  nextScheduleDate,
  reason,
}) => {
  const payload = {};

  if (String(assignment.status || "").trim().toLowerCase() !== "rescheduled") {
    payload.status = "rescheduled";
  }

  if (hasDateChanged(assignment.scheduled_on, nextScheduleDate)) {
    payload.scheduled_on = nextScheduleDate;
  }

  const currentRemarks = normalizeNullableText(assignment.remarks);
  const nextRemarks = normalizeNullableText(reason ?? assignment.remarks);
  if (currentRemarks !== nextRemarks) {
    payload.remarks = nextRemarks;
  }

  if (assignment.ended_at !== null && assignment.ended_at !== undefined) {
    payload.ended_at = null;
  }

  if (assignment.ended_by !== null && assignment.ended_by !== undefined) {
    payload.ended_by = null;
  }

  return payload;
};

async function applyInspectionReschedule({
  inspection,
  nextScheduleDate,
  reason,
  transaction,
  inspectorId,
  assignmentId,
}) {
  const payload = buildInspectionReschedulePayload({
    inspection,
    nextScheduleDate,
    reason,
    inspectorId,
    assignmentId,
  });

  if (Object.keys(payload).length > 0) {
    await inspection.update(payload, { transaction });
  }

  return payload;
}

async function applyAssignmentReschedule({
  assignment,
  nextScheduleDate,
  reason,
  transaction,
}) {
  const payload = buildAssignmentReschedulePayload({
    assignment,
    nextScheduleDate,
    reason,
  });

  if (Object.keys(payload).length > 0) {
    await assignment.update(payload, { transaction });
  }

  return payload;
}

async function syncInspectionAndAssignmentSchedule({
  inspection,
  assignment,
  nextScheduleDate,
  reason,
  transaction,
}) {
  const linkedAssignment =
    assignment ||
    (Number(inspection?.assignment_id || 0) > 0
      ? await InspectionAssignment.findByPk(Number(inspection.assignment_id), {
        transaction,
      })
      : null);

  const inspectionPayload = await applyInspectionReschedule({
    inspection,
    nextScheduleDate,
    reason,
    transaction,
  });

  const assignmentPayload = linkedAssignment
    ? await applyAssignmentReschedule({
      assignment: linkedAssignment,
      nextScheduleDate,
      reason,
      transaction,
    })
    : null;

  return {
    linkedAssignment,
    inspectionPayload,
    assignmentPayload,
  };
}

async function syncAssignmentAndInspectionSchedules({
  assignment,
  nextScheduleDate,
  reason,
  transaction,
  inspections,
}) {
  const assignmentPayload = await applyAssignmentReschedule({
    assignment,
    nextScheduleDate,
    reason,
    transaction,
  });

  const linkedInspections = inspections || await Inspection.findAll({
    where: {
      assignment_id: assignment.id,
      status: { [Op.ne]: "completed" },
    },
    transaction,
  });

  const inspectionUpdates = [];
  for (const inspection of linkedInspections) {
    const inspectionPayload = await applyInspectionReschedule({
      inspection,
      nextScheduleDate,
      reason,
      transaction,
      inspectorId: assignment.inspector_id,
      assignmentId: assignment.id,
    });
    inspectionUpdates.push({
      inspection_id: Number(inspection.id || 0) || null,
      payload: inspectionPayload,
    });
  }

  return {
    assignmentPayload,
    linkedInspections,
    inspectionUpdates,
  };
}

async function upsertItemInspection({
  caseId,
  poId,
  poItemId,
  assignmentId,
  inspectorId,
  inspection_location,
  schedule_datetime,
  assigned_by,
  trx,
}) {
  // canonical inspection for (case_id + purchase_order_item_id)
  let insp = await Inspection.findOne({
    where: { case_id: caseId, purchase_order_item_id: poItemId },
    order: [["id", "DESC"]],
    transaction: trx,
  });

  const parsedSchedule = schedule_datetime ? new Date(schedule_datetime) : null;
  const nextSchedule =
    parsedSchedule && !Number.isNaN(parsedSchedule.getTime()) ? parsedSchedule : null;

  if (insp) {
    const currentStatus = String(insp.status || "").trim().toLowerCase();
    const terminalStatuses = new Set(["cancelled", "rejected", "completed"]);
    const assignmentChanged = Number(insp.assignment_id || 0) !== Number(assignmentId || 0);
    const inspectorChanged = Number(insp.inspector_id || 0) !== Number(inspectorId || 0);
    const currentScheduleMs = insp.schedule_datetime
      ? new Date(insp.schedule_datetime).getTime()
      : null;
    const nextScheduleMs = nextSchedule ? nextSchedule.getTime() : null;
    const scheduleChanged =
      nextScheduleMs !== null && (!Number.isFinite(currentScheduleMs) || currentScheduleMs !== nextScheduleMs);

    let nextStatus = currentStatus || "assigned";
    if (!currentStatus || terminalStatuses.has(currentStatus) || assignmentChanged || inspectorChanged) {
      nextStatus = "assigned";
    } else if (scheduleChanged) {
      nextStatus = "rescheduled";
    }

    await insp.update(
      {
        po_id: poId,
        case_id: caseId,
        purchase_order_item_id: poItemId,
        inspector_id: inspectorId,
        assignment_id: assignmentId,
        inspection_location: inspection_location ?? insp.inspection_location,
        schedule_datetime: nextSchedule ?? insp.schedule_datetime,
        status: nextStatus,
        assigned_by: assigned_by ?? insp.assigned_by,
      },
      { transaction: trx }
    );
    return insp;
  }

  insp = await Inspection.create(
    {
      po_id: poId,
      case_id: caseId,
      purchase_order_item_id: poItemId,
      inspector_id: inspectorId,
      assignment_id: assignmentId,
      inspection_location: inspection_location ?? null,
      schedule_datetime: nextSchedule,
      status: "assigned",
      assigned_by: assigned_by ?? null,
    },
    { transaction: trx }
  );

  return insp;
}
// ================= HELPERS (Paste above class inspectionsController) =================
const toArr = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
      return [v];
    } catch {
      return [v];
    }
  }
  return [v];
};
const normalizePoAttachments = (value) => {
  const attachments = toArr(value)
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);

  return {
    attachment: attachments[0] || null,
    attachments,
  };
};
const normalizePoDesignCopies = (value) => {
  const designCopies = toArr(value)
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);

  return {
    design_copy: designCopies[0] || null,
    design_copies: designCopies,
  };
};
function ensureUniqueById(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const id = Number(r.id);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}
const docsArr = (documents) => {
  if (!documents) return [];
  if (Array.isArray(documents)) return documents;

  if (typeof documents === "string") {
    try {
      const parsed = JSON.parse(documents);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// âœ… Test table se design documents pick karne ka helper
// NOTE: aapke Test table me design docs ka column jo bhi ho (design_document / design_docs / attachment etc)
// in keys me se match ho jayega. Agar aapka column different hai to yahan key add kar dena.
const getDesignDocsFromTest = (tm) => {
  const keys = [
    "design_documents",
    "design_document",
    "design_doc",
    "design_docs",
    "documents",
    "document",
    "attachment",
    "attachments",
    "file",
    "files",
  ];

  for (const k of keys) {
    if (tm && tm[k]) return toArr(tm[k]);
  }
  return [];
};

const isInspectionDebugEnabled = () => {
  const raw = String(process.env.DEBUG_INSPECTION || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
};

const inspectionDebug = (scope, payload) => {
  if (!isInspectionDebugEnabled()) return;

  console.log(`[INSPECTION_DEBUG] ${new Date().toISOString()} ${scope}`);
  if (payload === undefined) return;

  try {
    console.dir(payload, { depth: 6, maxArrayLength: 100 });
  } catch {
    console.log(payload);
  }
};

const isAdminUser = (req) => {
  const candidates = [
    req?.user?.role,
    req?.user?.fullData?.role_name,
    req?.user?.fullData?.role,
  ];

  const hasAdminRole = candidates.some((value) =>
    String(value || "").trim().toLowerCase().includes("admin"),
  );
  if (hasAdminRole) return true;

  const userPermissions = Array.isArray(req?.user?.permissions) ? req.user.permissions : [];
  const adminLikePermissions = [
    "manage_all_inspections",
    "manage_inspection",
    "reschedule_inspection",
    "cancel_inspection",
    "reschedule_inspection_item",
    "cancel_inspection_item",
  ];

  return userPermissions.some((key) => adminLikePermissions.includes(String(key || "").trim()));
};

const isInspectorUser = (req) => {
  const candidates = [
    req?.user?.role,
    req?.user?.fullData?.role_name,
    req?.user?.fullData?.role,
  ];

  return candidates.some((value) =>
    String(value || "").trim().toLowerCase().includes("inspector"),
  );
};

class inspectionsController {

  static async startOrResumeBatch(req, res) {
    try {
      const { inspection_id, purchase_order_item_id, selected_quantity } = req.body;

      if (!inspection_id || !purchase_order_item_id || !selected_quantity) {
        return res.status(400).json({
          success: false,
          message: "inspection_id, purchase_order_item_id, selected_quantity required"
        });
      }

      const inspectionId = Number(inspection_id);
      const poItemId = Number(purchase_order_item_id);
      const qty = Number(selected_quantity);

      if (!Number.isFinite(inspectionId) || !Number.isFinite(poItemId) || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: "invalid values" });
      }

      const poItem = await PurchaseOrderItem.findByPk(poItemId);
      if (!poItem) return res.status(400).json({ success: false, message: "purchase_order_item not found" });

      const totalQty = Number(poItem.quantity || 0);

      // âœ… already allocated (active + completed, exclude cancelled)
      const batches = await InspectionBatch.findAll({
        where: {
          inspection_id: inspectionId,
          purchase_order_item_id: poItemId,
          status: { [Op.ne]: "cancelled" }
        },
        raw: true
      });

      const alreadySelected = batches.reduce((s, b) => s + Number(b.selected_quantity || 0), 0);
      const remainingAllowed = Math.max(totalQty - alreadySelected, 0);

      if (qty > remainingAllowed) {
        return res.status(400).json({
          success: false,
          message: `You can select max ${remainingAllowed} (remaining quantity)`,
          totalQty,
          alreadySelected,
          remainingAllowed
        });
      }

      // âœ… check active batch
      const activeBatch = await InspectionBatch.findOne({
        where: {
          inspection_id: inspectionId,
          purchase_order_item_id: poItemId,
          status: "active"
        }
      });

      if (activeBatch) {
        // âœ… if same qty -> resume
        if (Number(activeBatch.selected_quantity) === qty) {
          return res.json({
            success: true,
            message: "Resumed existing batch",
            data: {
              batch_id: activeBatch.id,
              selected_quantity: activeBatch.selected_quantity
            }
          });
        }

        // âœ… if different qty -> close old active batch then create new
        // await activeBatch.update({
        //   status: "cancelled",          // or "completed" based on your rule
        //   result: "cancelled",
        //   ended_by: req.user?.id ?? null
        // });

        // NOTE: because we cancelled old active batch, the remainingAllowed should increase back,
        // but we already validated qty against remainingAllowed BEFORE cancellation.
        // So let's re-check quickly with fresh remaining:
        const freshBatches = await InspectionBatch.findAll({
          where: {
            inspection_id: inspectionId,
            purchase_order_item_id: poItemId,
            status: { [Op.ne]: "cancelled" }
          },
          raw: true
        });
        const freshAlreadySelected = freshBatches.reduce((s, b) => s + Number(b.selected_quantity || 0), 0);
        const freshRemainingAllowed = Math.max(totalQty - freshAlreadySelected, 0);

        if (qty > freshRemainingAllowed) {
          return res.status(400).json({
            success: false,
            message: `You can select max ${freshRemainingAllowed} (remaining quantity)`,
            totalQty,
            alreadySelected: freshAlreadySelected,
            remainingAllowed: freshRemainingAllowed
          });
        }
      }
      const inspection = await Inspection.findByPk(inspectionId);

      if (!inspection) {
        return res.status(400).json({
          success: false,
          message: "Inspection not found"
        });
      }

      // ðŸ”¥ assignment_id from inspection
      const assignmentId = inspection.assignment_id;
      // âœ… create new batch
      const newBatch = await InspectionBatch.create({
        inspection_id: inspectionId,
        assignment_id: assignmentId,
        purchase_order_item_id: poItemId,
        selected_quantity: qty,
        status: "active",
        started_by: req.user?.id ?? null
      });

      return res.json({
        success: true,
        message: "Batch started",
        data: {
          batch_id: newBatch.id,
          selected_quantity: newBatch.selected_quantity
        }
      });

    } catch (e) {
      console.error("startOrResumeBatch:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static assignInspector = async (req, res) => {
    const sequelize = InspectionAssignment.sequelize;
    let trx;

    try {
      const {
        po_id,
        inspector_id,
        inspection_location,
        schedule_datetime,
        remarks,
        item_ids = [],
      } = req.body;

      if (!po_id || !inspector_id || !schedule_datetime || !inspection_location) {
        return res.status(400).json({ status: "error", message: "Required fields missing" });
      }

      trx = await sequelize.transaction();

      // 1) Ensure case exists (1 per PO)
      let inspectionCase = await InspectionCase.findOne({
        where: { po_id: Number(po_id) },
        transaction: trx,
      });

      if (!inspectionCase) {
        inspectionCase = await InspectionCase.create(
          { po_id: Number(po_id), status: "open" },
          { transaction: trx }
        );
      }

      // 2) Resolve itemsToAssign
      let itemsToAssign = [];
      if (Array.isArray(item_ids) && item_ids.length > 0) {
        itemsToAssign = item_ids.map(Number);
      } else {
        const poItems = await PurchaseOrderItem.findAll({
          where: { po_id: Number(po_id) },
          attributes: ["id"],
          transaction: trx,
        });
        itemsToAssign = poItems.map((i) => Number(i.id));
      }

      if (!itemsToAssign.length) {
        await trx.rollback();
        return res.status(400).json({ status: "error", message: "No items found to assign" });
      }

      // 3) Mark existing ACTIVE assignment_items for these items as reassigned
      await InspectionAssignmentItem.update(
        {
          status: "reassigned",
          ended_at: new Date(),
          ended_by: req.user?.id ?? null,
        },
        {
          where: {
            purchase_order_item_id: { [Op.in]: itemsToAssign },
          },
          transaction: trx,
        }
      );

      // 4) Create NEW assignment session
      const assignment = await InspectionAssignment.create(
        {
          case_id: inspectionCase.id,
          inspector_id: Number(inspector_id),
          inspection_location,
          scheduled_on: new Date(schedule_datetime),
          remarks: remarks ?? null,
          status: "assigned",
          assigned_by: req.user?.id ?? null,
        },
        { transaction: trx }
      );

      // 5) Create assignment items
      const bulkItems = itemsToAssign.map((poItemId) => ({
        assignment_id: assignment.id,
        purchase_order_item_id: Number(poItemId),
        status: "active",
      }));
      // âœ… After assignment + assignment items created (inside same transaction trx)
      for (const poItemId of itemsToAssign.map(Number)) {
        await upsertItemInspection({
          caseId: inspectionCase.id,
          poId: Number(po_id),
          poItemId,
          assignmentId: assignment.id,
          inspectorId: Number(inspector_id),
          inspection_location,
          schedule_datetime,
          assigned_by: req.user?.id ?? null,
          trx,
        });
      }

      await InspectionAssignmentItem.bulkCreate(bulkItems, { transaction: trx });

      // 6) Event log
      await InspectionEvent.create(
        {
          inspection_id: null,
          assignment_id: assignment.id,
          case_id: inspectionCase.id,
          po_id: Number(po_id),
          actor_user_id: req.user?.id ?? null,
          type: "assign_inspector",
          note: "Inspector assigned",
          before: null,
          after: {
            assignment_id: assignment.id,
            inspector_id: Number(inspector_id),
            inspection_location,
            schedule_datetime,
            remarks: remarks ?? null,
            item_ids: itemsToAssign,
          },
        },
        { transaction: trx }
      );

      await trx.commit();

      return res.json({
        status: "success",
        message: "Inspector assigned successfully",
        data: { assignment_id: assignment.id, items_assigned: bulkItems.length },
      });
    } catch (error) {
      if (trx) await trx.rollback();
      console.error("Assign Inspector Error:", error);
      return res.status(500).json({ status: "error", message: "Internal server error" });
    }
  };

  static getAssignedPoList = async (req, res) => {
    try {
      const inspectorId = req.user.id;
      const status = req.query.status;
      const requestedDate = String(req.query.date || req.query.inspection_date || "").trim();
      const targetDate = requestedDate ? toYmd(requestedDate) : toYmd(new Date());

      inspectionDebug("getAssignedPoList.request", {
        inspector_id: inspectorId,
        status_query: status || null,
        requested_date: requestedDate || null,
        target_date: targetDate,
        query: req.query,
      });

      if (!targetDate) {
        inspectionDebug("getAssignedPoList.validation_failed", { reason: "Invalid date" });
        return res.status(400).json({
          status: "error",
          message: "Invalid date"
        });
      }

      const dayStart = new Date(`${targetDate}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const validStatuses = new Set([
        "assigned",
        "in_progress",
        "rework",
        "failed",
        "rescheduled",
        "cancelled",
        "rejected",
        "completed",
      ]);
      const requestedStatuses = String(status || "")
        .split(",")
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean);

      if (requestedStatuses.length > 0 && requestedStatuses.some((s) => !validStatuses.has(s))) {
        return res.status(400).json({
          status: "error",
          message: "Invalid status filter",
        });
      }

      const effectiveStatuses =
        requestedStatuses.length > 0
          ? requestedStatuses
          : ["assigned", "in_progress", "rework", "failed", "rescheduled"];
      const inspectionWhere = {
        inspector_id: inspectorId,
        status: {
          [Op.in]: effectiveStatuses
        },
        schedule_datetime: {
          [Op.gte]: dayStart,
          [Op.lt]: dayEnd
        }
      };

      inspectionDebug("getAssignedPoList.query_filters", {
        where: inspectionWhere,
        effective_statuses: effectiveStatuses,
        day_start: dayStart.toISOString(),
        day_end: dayEnd.toISOString(),
      });

      const inspections = await Inspection.findAll({
        where: inspectionWhere,
        include: [
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "design_copy", "attachment"],
            include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
          },
          {
            model: PurchaseOrderItem,
            as: "PoItem",
            attributes: ["id", "item_id", "quantity"],
            include: [{ model: Items, attributes: ["id", "item_name"] }],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      const inspIds = inspections.map((i) => i.id);
      const itemIds = inspections.map((i) => i.purchase_order_item_id).filter(Boolean);
      inspectionDebug("getAssignedPoList.inspections_fetched", {
        count: inspections.length,
        inspection_ids: inspIds.slice(0, 25),
        item_ids: itemIds.slice(0, 25),
      });

      const stageMap = {};
      let stageRows = [];
      if (inspIds.length && itemIds.length) {
        stageRows = await PoStage.findAll({
          where: {
            inspection_id: { [Op.in]: inspIds },
            item_id: { [Op.in]: itemIds }
          },
          attributes: ["inspection_id", "item_id", "status"],
          raw: true
        });

        for (const r of stageRows) {
          const key = `${r.inspection_id}_${r.item_id}`;
          if (!stageMap[key]) stageMap[key] = { total: 0, completed: 0 };
          stageMap[key].total += 1;
          if (normalizeStageStatus(r.status) === "completed") stageMap[key].completed += 1;
        }
      }
      inspectionDebug("getAssignedPoList.stage_rows_fetched", {
        stage_rows_count: stageRows.length,
      });

      const result = inspections.map((insp) => {
        const po = insp.PurchaseOrder;
        const item = insp.PoItem;
        const key = `${insp.id}_${insp.purchase_order_item_id}`;
        const counts = stageMap[key] || { total: 0, completed: 0 };
        const poAttachments = normalizePoAttachments(po?.attachment);
        const poDesignCopies = normalizePoDesignCopies(po?.design_copy);

        return {
          assignment_id: insp.assignment_id || 0,
          inspection_id: insp.id,
          case_id: insp.case_id,
          po_id: po?.id || null,
          po_number: po?.po_number || "",
          vendor: po?.Vendor?.vendor_name || "",
          vendor_id: po?.Vendor?.id || null,
          design_copy: poDesignCopies.design_copy,
          design_copies: poDesignCopies.design_copies,
          attachment: poAttachments.attachment,
          attachments: poAttachments.attachments,
          scheduled_on: insp.schedule_datetime,
          total_stages: counts.total,
          completed_stages: counts.completed,
          status: insp.status || "assigned",
          purchase_order_item_id: insp.purchase_order_item_id,
          item_name: item?.Item?.item_name || item?.Items?.item_name || null
        };
      });

      inspectionDebug("getAssignedPoList.response", {
        count: result.length,
        first_item: result[0] || null,
      });
      return res.json({ status: "success", data: result });
    } catch (err) {
      inspectionDebug("getAssignedPoList.error", {
        message: err?.message || String(err),
      });
      console.error(err);
      res.status(500).json({ status: "error", message: "Server Error " + err.message });
    }
  };

  static getInspectorReportFilters = async (req, res) => {
    try {
      const inspectorId = Number(req.user?.id || 0);
      if (!Number.isFinite(inspectorId) || inspectorId <= 0) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const publicBaseUrl = getPublicBaseUrl(req);
      const sortUniqueStrings = (values) =>
        [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b));

      const inspections = await Inspection.findAll({
        where: { inspector_id: inspectorId },
        include: [
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "project_name", "design_copy", "attachment"],
            include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
          },
          {
            model: PurchaseOrderItem,
            as: "PoItem",
            attributes: ["id", "item_id", "quantity"],
            include: [{ model: Items, attributes: ["id", "item_name"] }],
          },
        ],
        order: [
          ["schedule_datetime", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      const assignments = await InspectionAssignment.findAll({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: REPORT_ASSIGNMENT_STATUSES },
        },
        include: [
          {
            association: "Case",
            required: true,
            include: [
              {
                association: "PurchaseOrder",
                attributes: ["id", "po_number", "project_name"],
                include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
              },
            ],
          },
        ],
        attributes: ["id", "case_id", "scheduled_on", "status", "updatedAt"],
        order: [
          ["scheduled_on", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      const stagesMaster = await Stage.findAll({
        attributes: ["id", "stage_name"],
        order: [["id", "ASC"]],
        raw: true,
      });

      const testAttributes =
        Test?.rawAttributes && ("stage_id" in Test.rawAttributes)
          ? ["id", "test_name", "stage_id"]
          : ["id", "test_name"];
      const testsMaster = await Test.findAll({
        attributes: testAttributes,
        order: [["id", "ASC"]],
        raw: true,
      });

      const testsByStageId = new Map();
      const allTestNames = sortUniqueStrings(testsMaster.map((row) => row?.test_name));
      for (const testRow of testsMaster) {
        const stageId = Number(testRow?.stage_id || 0);
        if (!stageId) continue;
        if (!testsByStageId.has(stageId)) {
          testsByStageId.set(stageId, []);
        }
        testsByStageId.get(stageId).push(String(testRow?.test_name || "").trim());
      }

      const stageTemplates = stagesMaster.map((stageRow) => {
        const stageId = Number(stageRow?.id || 0);
        let testNames = [];
        if (testsByStageId.size > 0) {
          testNames = sortUniqueStrings(testsByStageId.get(stageId) || []);
        }
        if (!testNames.length) {
          testNames = [...allTestNames];
        }
        return {
          stage_id: stageId,
          stage_name: stageRow?.stage_name || `Stage ${stageId || "-"}`,
          test_names: testNames,
        };
      });

      const assignmentIds = assignments.map((assignment) => Number(assignment?.id || 0)).filter(Boolean);
      const assignmentMeta = new Map();
      for (const assignment of assignments) {
        assignmentMeta.set(Number(assignment.id), assignment);
      }

      const assignmentItems = assignmentIds.length
        ? await InspectionAssignmentItem.findAll({
          where: {
            assignment_id: { [Op.in]: assignmentIds },
            status: "active",
          },
          include: [
            {
              association: "PoItem",
              required: true,
              attributes: ["id", "po_id", "item_id", "quantity"],
              include: [{ model: Items, attributes: ["id", "item_name"], required: false }],
            },
          ],
          order: [
            ["assignment_id", "DESC"],
            ["id", "DESC"],
          ],
        })
        : [];

      if (!inspections.length && !assignmentItems.length) {
        return res.json({
          success: true,
          meta: {
            filter_options: {
              project_names: [],
              po_numbers: [],
              item_names: [],
              stage_names: [],
              test_names: [],
              statuses: [],
            },
            filter_tree: [],
            document_base_url: publicBaseUrl || null,
          },
          data: [],
        });
      }

      const filterTreeMap = new Map();
      for (const inspection of inspections) {
        const po = inspection?.PurchaseOrder || null;
        const itemId = Number(inspection?.purchase_order_item_id || inspection?.PoItem?.id || 0) || 0;
        const inspectionStatus = normalizeStatusFilter(inspection?.status || "") || "assigned";
        const node = {
          purchase_order_item_id: itemId,
          inspection_status: inspectionStatus,
          project_name: String(po?.project_name || "").trim(),
          po_number: String(po?.po_number || "").trim(),
          vendor_name: String(po?.Vendor?.vendor_name || "").trim(),
          item_name: String(pickItemName(inspection) || "").trim(),
          stages: stageTemplates.map((stage) => ({
            stage_id: Number(stage.stage_id || 0),
            stage_name: String(stage.stage_name || "").trim(),
            test_names: [...(stage.test_names || [])],
          })),
        };

        const key = [
          node.inspection_status,
          node.project_name.toLowerCase(),
          node.po_number.toLowerCase(),
          String(node.purchase_order_item_id || 0),
          node.item_name.toLowerCase(),
        ].join("|");

        if (!filterTreeMap.has(key)) {
          filterTreeMap.set(key, node);
        }
      }

      for (const assignmentItem of assignmentItems) {
        const assignmentId = Number(assignmentItem?.assignment_id || 0);
        const assignment = assignmentMeta.get(assignmentId) || null;
        const po = assignment?.Case?.PurchaseOrder || null;
        const poItem = assignmentItem?.PoItem || null;
        const itemId = Number(poItem?.id || 0);
        if (!assignment || !po || !poItem || !itemId) {
          continue;
        }

        const node = {
          purchase_order_item_id: itemId,
          inspection_status: normalizeStatusFilter(assignment?.status || "") || "assigned",
          project_name: String(po?.project_name || "").trim(),
          po_number: String(po?.po_number || "").trim(),
          vendor_name: String(po?.Vendor?.vendor_name || "").trim(),
          item_name: String(pickItemName({ PoItem: poItem }) || "").trim(),
          stages: stageTemplates.map((stage) => ({
            stage_id: Number(stage.stage_id || 0),
            stage_name: String(stage.stage_name || "").trim(),
            test_names: [...(stage.test_names || [])],
          })),
        };

        const key = [
          node.inspection_status,
          node.project_name.toLowerCase(),
          node.po_number.toLowerCase(),
          String(node.purchase_order_item_id || 0),
          node.item_name.toLowerCase(),
        ].join("|");

        if (!filterTreeMap.has(key)) {
          filterTreeMap.set(key, node);
        }
      }

      const filterTree = Array.from(filterTreeMap.values()).sort((a, b) => {
        const projectCompare = a.project_name.localeCompare(b.project_name);
        if (projectCompare !== 0) return projectCompare;
        const poCompare = a.po_number.localeCompare(b.po_number);
        if (poCompare !== 0) return poCompare;
        const itemCompare = a.item_name.localeCompare(b.item_name);
        if (itemCompare !== 0) return itemCompare;
        const leftIndex = REPORT_STATUS_ORDER.indexOf(a.inspection_status);
        const rightIndex = REPORT_STATUS_ORDER.indexOf(b.inspection_status);
        const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        if (normalizedLeftIndex !== normalizedRightIndex) {
          return normalizedLeftIndex - normalizedRightIndex;
        }
        return a.inspection_status.localeCompare(b.inspection_status);
      });

      const filterOptions = {
        project_names: sortUniqueStrings(filterTree.map((node) => node.project_name)),
        po_numbers: sortUniqueStrings(filterTree.map((node) => node.po_number)),
        item_names: sortUniqueStrings(filterTree.map((node) => node.item_name)),
        stage_names: sortUniqueStrings(stageTemplates.map((stage) => stage.stage_name)),
        test_names: sortUniqueStrings(filterTree.flatMap((node) => (node.stages || []).flatMap((stage) => stage.test_names || []))),
        statuses: sortUniqueStatuses(filterTree.map((node) => node.inspection_status)),
      };

      return res.json({
        success: true,
        meta: {
          filter_options: filterOptions,
          filter_tree: filterTree,
          document_base_url: publicBaseUrl || null,
        },
        data: [],
      });
    } catch (e) {
      console.error("getInspectorReportFilters:", e);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };

  static getInspectorReportPoOptions = async (req, res) => {
    try {
      const inspectorId = Number(req.user?.id || 0);
      if (!Number.isFinite(inspectorId) || inspectorId <= 0) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const inspections = await Inspection.findAll({
        where: { inspector_id: inspectorId },
        include: [
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "project_name"],
            include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
          },
        ],
        attributes: ["id", "po_id", "schedule_datetime", "updatedAt"],
        order: [
          ["schedule_datetime", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      const assignments = await InspectionAssignment.findAll({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: REPORT_ASSIGNMENT_STATUSES },
        },
        include: [
          {
            association: "Case",
            required: true,
            include: [
              {
                association: "PurchaseOrder",
                attributes: ["id", "po_number", "project_name"],
                include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
              },
            ],
          },
        ],
        attributes: ["id", "case_id", "scheduled_on", "status", "updatedAt"],
        order: [
          ["scheduled_on", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      const poOptions = new Map();
      const upsertPoOption = (payload) => {
        const poId = Number(payload?.po_id || 0);
        if (!poId) return;

        const current = poOptions.get(poId) || null;
        const nextTimestamp = toValidTimestamp(payload?.inspection_date);
        const currentTimestamp = toValidTimestamp(current?.inspection_date);
        if (!current || nextTimestamp >= currentTimestamp) {
          poOptions.set(poId, {
            po_id: poId,
            po_number: String(payload?.po_number || "").trim(),
            project_name: String(payload?.project_name || "").trim(),
            vendor_name: String(payload?.vendor_name || "").trim(),
            inspection_date: payload?.inspection_date || null,
          });
        }
      };

      for (const inspection of inspections) {
        const po = inspection?.PurchaseOrder || null;
        const poId = Number(po?.id || inspection?.po_id || 0);
        if (!po || !poId) {
          continue;
        }
        upsertPoOption({
          po_id: poId,
          po_number: String(po?.po_number || "").trim(),
          project_name: String(po?.project_name || "").trim(),
          vendor_name: String(po?.Vendor?.vendor_name || "").trim(),
          inspection_date: inspection?.schedule_datetime || null,
        });
      }

      for (const assignment of assignments) {
        const po = assignment?.Case?.PurchaseOrder || null;
        const poId = Number(po?.id || assignment?.Case?.po_id || 0);
        if (!po || !poId) {
          continue;
        }
        upsertPoOption({
          po_id: poId,
          po_number: String(po?.po_number || "").trim(),
          project_name: String(po?.project_name || "").trim(),
          vendor_name: String(po?.Vendor?.vendor_name || "").trim(),
          inspection_date: assignment?.scheduled_on || null,
        });
      }

      const data = Array.from(poOptions.values()).sort((left, right) => {
        const dateCompare = toValidTimestamp(right?.inspection_date) - toValidTimestamp(left?.inspection_date);
        if (dateCompare !== 0) return dateCompare;
        return String(left?.po_number || "").localeCompare(String(right?.po_number || ""));
      });

      return res.json({
        success: true,
        data,
      });
    } catch (e) {
      console.error("getInspectorReportPoOptions:", e);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };

  static getInspectorReportItemOptions = async (req, res) => {
    try {
      const inspectorId = Number(req.user?.id || 0);
      const poId = Number(req.params?.poId || req.query?.po_id || 0);
      if (!Number.isFinite(inspectorId) || inspectorId <= 0) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      if (!Number.isFinite(poId) || poId <= 0) {
        return res.status(400).json({ success: false, message: "Valid po_id is required" });
      }

      const inspections = await Inspection.findAll({
        where: {
          inspector_id: inspectorId,
          po_id: poId,
        },
        include: [
          {
            model: PurchaseOrderItem,
            as: "PoItem",
            attributes: ["id", "item_id", "quantity"],
            include: [{ model: Items, attributes: ["id", "item_name"] }],
          },
        ],
        attributes: ["id", "purchase_order_item_id", "schedule_datetime", "status", "updatedAt"],
        order: [
          ["schedule_datetime", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      const assignments = await InspectionAssignment.findAll({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: REPORT_ASSIGNMENT_STATUSES },
        },
        include: [
          {
            association: "Case",
            required: true,
            where: { po_id: poId },
          },
        ],
        attributes: ["id", "case_id", "scheduled_on", "status", "updatedAt"],
        order: [
          ["scheduled_on", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      const assignmentIds = assignments.map((assignment) => Number(assignment?.id || 0)).filter(Boolean);
      const assignmentMeta = new Map();
      for (const assignment of assignments) {
        assignmentMeta.set(Number(assignment.id), assignment);
      }

      const assignmentItems = assignmentIds.length
        ? await InspectionAssignmentItem.findAll({
          where: {
            assignment_id: { [Op.in]: assignmentIds },
            status: "active",
          },
          include: [
            {
              association: "PoItem",
              required: true,
              attributes: ["id", "po_id", "item_id", "quantity"],
              include: [{ model: Items, attributes: ["id", "item_name"], required: false }],
            },
          ],
          order: [
            ["assignment_id", "DESC"],
            ["id", "DESC"],
          ],
        })
        : [];

      const itemOptions = new Map();
      const upsertItemOption = (payload) => {
        const itemId = Number(payload?.purchase_order_item_id || 0);
        if (!itemId) return;

        const current = itemOptions.get(itemId) || null;
        const nextTimestamp = toValidTimestamp(payload?.inspection_date);
        const currentTimestamp = toValidTimestamp(current?.inspection_date);
        if (!current || nextTimestamp >= currentTimestamp) {
          itemOptions.set(itemId, {
            purchase_order_item_id: itemId,
            item_name: String(payload?.item_name || "").trim(),
            quantity: Number(payload?.quantity || 0),
            inspection_date: payload?.inspection_date || null,
            status: normalizeStatusFilter(payload?.status || "") || "assigned",
          });
        }
      };

      for (const inspection of inspections) {
        const poItem = inspection?.PoItem || null;
        const itemId = Number(inspection?.purchase_order_item_id || poItem?.id || 0);
        if (!poItem || !itemId) {
          continue;
        }
        upsertItemOption({
          purchase_order_item_id: itemId,
          item_name: String(pickItemName(inspection) || "").trim(),
          quantity: Number(poItem?.quantity || 0),
          inspection_date: inspection?.schedule_datetime || null,
          status: normalizeStatusFilter(inspection?.status || "") || "assigned",
        });
      }

      for (const assignmentItem of assignmentItems) {
        const assignment = assignmentMeta.get(Number(assignmentItem?.assignment_id || 0)) || null;
        const poItem = assignmentItem?.PoItem || null;
        const itemId = Number(poItem?.id || 0);
        if (!assignment || !poItem || !itemId) {
          continue;
        }
        upsertItemOption({
          purchase_order_item_id: itemId,
          item_name: String(pickItemName({ PoItem: poItem }) || "").trim(),
          quantity: Number(poItem?.quantity || 0),
          inspection_date: assignment?.scheduled_on || null,
          status: assignment?.status || "assigned",
        });
      }

      const data = Array.from(itemOptions.values()).sort((left, right) => {
        const dateCompare = toValidTimestamp(right?.inspection_date) - toValidTimestamp(left?.inspection_date);
        if (dateCompare !== 0) return dateCompare;
        return String(left?.item_name || "").localeCompare(String(right?.item_name || ""));
      });

      return res.json({
        success: true,
        data,
      });
    } catch (e) {
      console.error("getInspectorReportItemOptions:", e);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };

  static getInspectorReports = async (req, res) => {
    try {
      const inspectorId = Number(req.user?.id || 0);
      if (!Number.isFinite(inspectorId) || inspectorId <= 0) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const normalizeFilterText = (value) => {
        const normalized = String(value || "").trim();
        return normalized || null;
      };
      const stripLabelSuffix = (value) => {
        if (!value) return null;
        const trimmed = String(value).trim();
        if (!trimmed) return null;
        const pipeIndex = trimmed.indexOf("|");
        if (pipeIndex === -1) return trimmed;
        return trimmed.slice(0, pipeIndex).trim();
      };

      const requestedFrom = String(req.query.date_from || "").trim();
      const requestedTo = String(req.query.date_to || "").trim();
      let requestedProjectName = normalizeFilterText(req.query.project_name);
      let requestedPoNumber = normalizeFilterText(req.query.po_number);
      let requestedItemName = normalizeFilterText(req.query.item_name);
      const requestedStageName = normalizeFilterText(req.query.stage_name);
      const requestedTestName = normalizeFilterText(req.query.test_name);
      const requestedPoIdRaw = String(req.query.po_id || "").trim();
      const requestedItemIdRaw = String(req.query.purchase_order_item_id || "").trim();
      const requestedPoId = requestedPoIdRaw ? Number(requestedPoIdRaw) : null;
      const requestedPurchaseOrderItemId = requestedItemIdRaw ? Number(requestedItemIdRaw) : null;

      requestedPoNumber = stripLabelSuffix(requestedPoNumber);
      requestedItemName = stripLabelSuffix(requestedItemName);

      if (requestedPoIdRaw && (!Number.isFinite(requestedPoId) || requestedPoId <= 0)) {
        return res.status(400).json({
          success: false,
          message: "Invalid po_id filter.",
        });
      }
      if (requestedItemIdRaw
        && (!Number.isFinite(requestedPurchaseOrderItemId) || requestedPurchaseOrderItemId <= 0)) {
        return res.status(400).json({
          success: false,
          message: "Invalid purchase_order_item_id filter.",
        });
      }

      if (requestedPoId) {
        requestedPoNumber = null;
        requestedProjectName = null;
      }
      if (requestedPurchaseOrderItemId) {
        requestedItemName = null;
      }

      let dateFrom = requestedFrom ? toYmd(requestedFrom) : null;
      let dateTo = requestedTo ? toYmd(requestedTo) : null;

      if ((requestedFrom && !dateFrom) || (requestedTo && !dateTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date range. Use yyyy-mm-dd format.",
        });
      }

      if (dateFrom && !dateTo) dateTo = dateFrom;
      if (!dateFrom && dateTo) dateFrom = dateTo;

      let fromStart = null;
      let toStart = null;
      let toExclusive = null;
      if (dateFrom || dateTo) {
        let effectiveFrom = dateFrom;
        let effectiveTo = dateTo;

        if (effectiveFrom && !effectiveTo) effectiveTo = effectiveFrom;
        if (!effectiveFrom && effectiveTo) effectiveFrom = effectiveTo;

        fromStart = toDayStart(effectiveFrom);
        toStart = toDayStart(effectiveTo);
        if (!fromStart || !toStart) {
          return res.status(400).json({
            success: false,
            message: "Invalid date range.",
          });
        }

        if (fromStart.getTime() > toStart.getTime()) {
          const tmpDate = effectiveFrom;
          effectiveFrom = effectiveTo;
          effectiveTo = tmpDate;
          const tmpStart = fromStart;
          fromStart = toStart;
          toStart = tmpStart;
        }

        toExclusive = toDayEndExclusive(effectiveTo);
        if (!toExclusive) {
          return res.status(400).json({
            success: false,
            message: "Invalid date range.",
          });
        }

        dateFrom = effectiveFrom;
        dateTo = effectiveTo;
      } else {
        dateFrom = null;
        dateTo = null;
      }

      const validStatuses = new Set([
        "assigned",
        "in_progress",
        "rework",
        "failed",
        "rescheduled",
        "cancelled",
        "rejected",
        "completed",
      ]);

      const requestedStatuses = String(req.query.status || "")
        .split(",")
        .map(normalizeStatusFilter)
        .filter(Boolean);

      if (requestedStatuses.length > 0 && requestedStatuses.some((s) => !validStatuses.has(s))) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter.",
        });
      }

      const effectiveStatuses = requestedStatuses.length
        ? sortUniqueStatuses(requestedStatuses)
        : [...REPORT_STATUS_ORDER];

      inspectionDebug("getInspectorReports.request", {
        inspector_id: inspectorId,
        date_from: dateFrom,
        date_to: dateTo,
        statuses: effectiveStatuses,
        po_id: requestedPoId || null,
        purchase_order_item_id: requestedPurchaseOrderItemId || null,
        project_name: requestedProjectName || null,
        po_number: requestedPoNumber || null,
        item_name: requestedItemName || null,
        stage_name: requestedStageName || null,
        test_name: requestedTestName || null,
      });

      const publicBaseUrl = getPublicBaseUrl(req);
      const purchaseOrderInclude = {
        model: PurchaseOrder,
        as: "PO",
        attributes: ["id", "po_number", "project_name", "design_copy", "attachment"],
        include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
      };
      if (requestedProjectName || requestedPoNumber || requestedPoId) {
        purchaseOrderInclude.where = {};
        if (requestedPoId) {
          purchaseOrderInclude.where.id = requestedPoId;
        }
        if (requestedProjectName) {
          purchaseOrderInclude.where.project_name = requestedProjectName;
        }
        if (requestedPoNumber) {
          purchaseOrderInclude.where.po_number = requestedPoNumber;
        }
        purchaseOrderInclude.required = true;
      }

      const itemInclude = { model: Items, attributes: ["id", "item_name"] };
      if (requestedItemName) {
        itemInclude.where = { item_name: requestedItemName };
        itemInclude.required = true;
      }

      const poItemInclude = {
        model: PurchaseOrderItem,
        as: "PoItem",
        attributes: ["id", "item_id", "quantity", "po_id"],
        include: [
          itemInclude,
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "project_name", "design_copy", "attachment"],
            include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
          },
        ],
      };
      if (requestedItemName || requestedPurchaseOrderItemId) {
        poItemInclude.where = {};
        if (requestedPurchaseOrderItemId) {
          poItemInclude.where.id = requestedPurchaseOrderItemId;
        }
        poItemInclude.required = true;
      }

      const inspectionWhere = {
        inspector_id: inspectorId,
        status: { [Op.in]: effectiveStatuses },
      };
      if (fromStart && toExclusive) {
        inspectionWhere.schedule_datetime = {
          [Op.gte]: fromStart,
          [Op.lt]: toExclusive,
        };
      }
      if (requestedPoId) {
        inspectionWhere.po_id = requestedPoId;
      }
      if (requestedPurchaseOrderItemId) {
        inspectionWhere.purchase_order_item_id = requestedPurchaseOrderItemId;
      }

      const inspections = await Inspection.findAll({
        where: inspectionWhere,
        include: [purchaseOrderInclude, poItemInclude],
        order: [
          ["schedule_datetime", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      if (!inspections.length) {
        return res.json({
          success: true,
          filters: {
            date_from: dateFrom,
            date_to: dateTo,
            statuses: effectiveStatuses,
            po_id: requestedPoId || null,
            purchase_order_item_id: requestedPurchaseOrderItemId || null,
            project_name: requestedProjectName || null,
            po_number: requestedPoNumber || null,
            item_name: requestedItemName || null,
            stage_name: requestedStageName || null,
            test_name: requestedTestName || null,
          },
          meta: {
            summary: {
              report_count: 0,
              project_count: 0,
              stage_count: 0,
              test_count: 0,
              document_count: 0,
              total_days: 0,
            },
            filter_options: {
              project_names: [],
              po_numbers: [],
              item_names: [],
              stage_names: [],
              test_names: [],
              statuses: effectiveStatuses,
            },
            document_base_url: publicBaseUrl || null,
          },
          data: [],
        });
      }

      const inspectionIds = [...new Set(inspections.map((i) => Number(i.id)).filter((id) => id > 0))];
      const itemIds = [
        ...new Set(
          inspections
            .map((i) => Number(i.purchase_order_item_id || i?.PoItem?.id || 0))
            .filter((id) => id > 0),
        ),
      ];
      const assignmentIds = [
        ...new Set(inspections.map((i) => Number(i.assignment_id || 0)).filter((id) => id > 0)),
      ];

      const assignmentRows = assignmentIds.length
        ? await InspectionAssignment.findAll({
            where: { id: { [Op.in]: assignmentIds } },
            attributes: ["id", "scheduled_on", "status", "createdAt", "updatedAt"],
            raw: true,
          })
        : [];
      const assignmentById = new Map(
        assignmentRows.map((row) => [Number(row.id || 0), row]),
      );

      const poStageWhere = {
        inspection_id: { [Op.in]: inspectionIds },
      };
      if (itemIds.length > 0) {
        poStageWhere.item_id = { [Op.in]: itemIds };
      }

      const poStageRows = await PoStage.findAll({
        where: poStageWhere,
        include: [{ model: Stage, attributes: ["id", "stage_name"] }],
        attributes: ["id", "inspection_id", "item_id", "stage_id", "status", "batch_id", "createdAt", "updatedAt"],
        order: [
          ["inspection_id", "DESC"],
          ["item_id", "ASC"],
          ["stage_id", "ASC"],
          ["id", "ASC"],
        ],
      });

      const stageRowsByInspectionItem = new Map();
      for (const row of poStageRows) {
        const key = `${Number(row.inspection_id || 0)}_${Number(row.item_id || 0)}`;
        if (!stageRowsByInspectionItem.has(key)) stageRowsByInspectionItem.set(key, []);
        stageRowsByInspectionItem.get(key).push(row);
      }

      const poStageIds = [...new Set(poStageRows.map((row) => Number(row.id || 0)).filter((id) => id > 0))];
      const stageTestRows = poStageIds.length
        ? await StageTest.findAll({
            where: { po_stage_id: { [Op.in]: poStageIds } },
            include: [{ model: Test, attributes: ["id", "test_name"] }],
            attributes: [
              "id",
              "po_stage_id",
              "inspection_id",
              "item_id",
              "test_id",
              "quantity",
              "result",
              "status",
              "remark",
              "description",
              "gps_location",
              "inspection_date",
              "documents",
              "createdAt",
              "updatedAt",
            ],
            order: [
              ["po_stage_id", "ASC"],
              ["test_id", "ASC"],
              ["id", "ASC"],
            ],
          })
        : [];

      const stageTestsByPoStageId = new Map();
      for (const row of stageTestRows) {
        const key = Number(row.po_stage_id || 0);
        if (!key) continue;
        if (!stageTestsByPoStageId.has(key)) stageTestsByPoStageId.set(key, []);
        stageTestsByPoStageId.get(key).push(row);
      }

      const resolveInspectionPo = (insp) => {
        if (!insp) return null;
        return insp.PO || insp.PurchaseOrder || insp?.PoItem?.PurchaseOrder || null;
      };

      const data = inspections
        .map((insp) => {
          const poItem = insp.PoItem || null;
          const po = resolveInspectionPo(insp);
          const itemId = Number(insp.purchase_order_item_id || poItem?.id || 0);
          const itemKey = `${Number(insp.id || 0)}_${itemId}`;
          const assignment = assignmentById.get(Number(insp.assignment_id || 0)) || null;
          const projectName = po?.project_name || "";
          const poNumber = po?.po_number || "";
          const itemName = pickItemName(insp) || "";

          if (!matchesTextFilter(projectName, requestedProjectName)
            || !matchesTextFilter(poNumber, requestedPoNumber)
            || !matchesTextFilter(itemName, requestedItemName)) {
            return null;
          }

          const stages = (stageRowsByInspectionItem.get(itemKey) || [])
            .map((stageRow) => {
              const stageId = Number(stageRow.stage_id || stageRow?.Stage?.id || 0);
              const stageName = stageRow?.Stage?.stage_name || `Stage ${stageId || "-"}`;
              if (!matchesTextFilter(stageName, requestedStageName)) {
                return null;
              }

              const stageStatus = normalizeReportStageStatus(stageRow.status);
              const rows = stageTestsByPoStageId.get(Number(stageRow.id || 0)) || [];

              const tests = rows
                .map((row) => {
                  const testId = Number(row.test_id || row?.Test?.id || 0);
                  if (!testId) {
                    return null;
                  }

                  const testName = row?.Test?.test_name || `Test ${testId}`;
                  if (!matchesTextFilter(testName, requestedTestName)) {
                    return null;
                  }

                  const execution = mapStageTestExecution(row);
                  const documents = normalizeDocuments(row.documents, publicBaseUrl).map((url, idx) => ({
                    name: `Document ${idx + 1}`,
                    url,
                  }));

                  return {
                    history_id: Number(row.id || 0),
                    test_id: testId,
                    test_name: testName,
                    status: execution.status,
                    result: execution.result,
                    pass_quantity: execution.pass_quantity,
                    fail_quantity: execution.fail_quantity,
                    remarks: String(row.remark || "").trim(),
                    description: String(row.description || "").trim(),
                    gps_location: pickLastNonEmptyValue([row.gps_location]),
                    docs_count: documents.length,
                    reported_on: resolveStageTestReportedOn(row),
                    documents,
                  };
                })
                .filter(Boolean)
                .sort((left, right) => {
                  const testCompare = Number(left.test_id || 0) - Number(right.test_id || 0);
                  if (testCompare !== 0) return testCompare;
                  return Number(left.history_id || 0) - Number(right.history_id || 0);
                });
              if (requestedTestName && tests.length === 0) {
                return null;
              }

              const stageStartedOn = pickFirstValidDate([
                ...rows.map((r) => r.createdAt),
                stageRow.createdAt,
                stageRow.updatedAt,
              ]) || null;
              const stageCompletedOn = pickLastValidDate([
                ...rows.map((r) => r.updatedAt),
                ...rows.map((r) => r.createdAt),
                stageRow.updatedAt,
                stageRow.createdAt,
              ]) || null;
              const docsCount = tests.reduce((sum, testRow) => sum + Number(testRow.docs_count || 0), 0);

              return {
                stage_id: stageId,
                po_stage_id: Number(stageRow.id || 0),
                stage_name: stageName,
                status: stageStatus,
                batch_id: Number(stageRow.batch_id || 0) || null,
                started_on: stageStartedOn,
                completed_on: stageCompletedOn,
                duration_days: calculateDurationDays(stageStartedOn, stageCompletedOn),
                updated_at: stageCompletedOn || stageRow.updatedAt || null,
                tests_count: tests.length,
                docs_count: docsCount,
                tests,
              };
            })
            .filter(Boolean)
            .sort((a, b) => Number(a.stage_id || 0) - Number(b.stage_id || 0));

          if ((requestedStageName || requestedTestName) && stages.length === 0) {
            return null;
          }

          const totalStages = stages.length;
          const completedStages = stages.filter((s) => s.status === "completed").length;
          const totalTests = stages.reduce((sum, s) => sum + Number(s.tests_count || 0), 0);
          const totalDocuments = stages.reduce((sum, s) => sum + Number(s.docs_count || 0), 0);

          const normalizedStatus = normalizeStatusFilter(insp.status || "") || "assigned";
          const latestReportedOn = pickLastValidDate(
            stages.flatMap((stage) => (stage.tests || []).map((test) => test?.reported_on)),
          ) || null;
          const inspectionDate = latestReportedOn;
          const assignedOn = assignment?.scheduled_on || null;
          const inspectionStartedOn = pickFirstValidDate([insp.createdAt, assignedOn]) || null;
          const latestStageUpdatedAt = pickLastValidDate(stages.map((stage) => stage.updated_at)) || null;
          const completedOn =
            (normalizedStatus === "completed"
              ? (latestReportedOn || latestStageUpdatedAt || insp.updatedAt || null)
              : (latestReportedOn || latestStageUpdatedAt || null));

          const poAttachments = normalizePoAttachments(po?.attachment);
          const poDesignCopies = normalizePoDesignCopies(po?.design_copy);

          return {
            inspection_id: Number(insp.id || 0),
            assignment_id: Number(insp.assignment_id || 0) || null,
            po_id: Number(po?.id || poItem?.po_id || insp.po_id || 0) || null,
            purchase_order_item_id: itemId || null,
            po_number: poNumber,
            project_name: projectName,
            vendor: po?.Vendor?.vendor_name || "",
            item_name: itemName,
            design_copy: poDesignCopies.design_copy,
            design_copies: poDesignCopies.design_copies,
            attachment: poAttachments.attachment,
            attachments: poAttachments.attachments,
            status: normalizedStatus,
            assigned_on: assignedOn || null,
            assigned_at: assignment?.createdAt || null,
            inspection_date: inspectionDate,
            inspection_started_on: inspectionStartedOn,
            completed_on: completedOn,
            inspection_duration_days: calculateDurationDays(
              inspectionStartedOn,
              completedOn || latestReportedOn || latestStageUpdatedAt || assignedOn,
            ),
            total_stages: totalStages,
            completed_stages: completedStages,
            total_tests: totalTests,
            total_documents: totalDocuments,
            stages,
          };
        })
        .filter(Boolean);

      inspectionDebug("getInspectorReports.response", {
        count: data.length,
        sample: data[0] || null,
      });

      const filterPoRows = inspections
        .map((row) => resolveInspectionPo(row))
        .filter(Boolean);

      const filterOptions = {
        project_names: [...new Set(filterPoRows.map((row) => String(row?.project_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        po_numbers: [...new Set(filterPoRows.map((row) => String(row?.po_number || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        item_names: [...new Set(inspections.map((row) => String(pickItemName(row) || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        stage_names: [...new Set(poStageRows.map((row) => String(row?.Stage?.stage_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        test_names: [...new Set(stageTestRows.map((row) => String(row?.Test?.test_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        statuses: sortUniqueStatuses(inspections.map((row) => row?.status || "")),
      };

      const summary = {
        report_count: data.length,
        project_count: [...new Set(data.map((row) => String(row?.project_name || "").trim().toLowerCase()).filter(Boolean))].length,
        stage_count: data.reduce((sum, row) => sum + Number(row?.total_stages || 0), 0),
        test_count: data.reduce((sum, row) => sum + Number(row?.total_tests || 0), 0),
        document_count: data.reduce((sum, row) => sum + Number(row?.total_documents || 0), 0),
        total_days: data.reduce((sum, row) => sum + Number(row?.inspection_duration_days || 0), 0),
      };

      return res.json({
        success: true,
          filters: {
            date_from: dateFrom,
            date_to: dateTo,
            statuses: effectiveStatuses,
            po_id: requestedPoId || null,
            purchase_order_item_id: requestedPurchaseOrderItemId || null,
            project_name: requestedProjectName || null,
            po_number: requestedPoNumber || null,
            item_name: requestedItemName || null,
            stage_name: requestedStageName || null,
          test_name: requestedTestName || null,
        },
        meta: {
          summary,
          filter_options: filterOptions,
          document_base_url: publicBaseUrl || null,
        },
        data,
      });
    } catch (e) {
      inspectionDebug("getInspectorReports.error", {
        message: e?.message || String(e),
      });
      console.error("getInspectorReports:", e);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };

  static startInspection = async (req, res) => {
    const sequelize = Inspection.sequelize;
    let trx;

    try {
      const { assignment_id } = req.body;
      if (!assignment_id) {
        return res.status(400).json({ success: false, message: "assignment_id required" });
      }

      trx = await sequelize.transaction();

      const asg = await InspectionAssignment.findByPk(Number(assignment_id), {
        transaction: trx,
        include: [{ association: "Case", required: true }],
      });

      if (!asg) {
        await trx.rollback();
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      // only assigned inspector can start
      if (Number(asg.inspector_id) !== Number(req.user.id)) {
        await trx.rollback();
        return res.status(403).json({ success: false, message: "Not allowed" });
      }

      const caseId = Number(asg.case_id);
      const casePoId = Number(asg.Case.po_id);

      const items = await InspectionAssignmentItem.findAll({
        where: { assignment_id: asg.id, status: "active" },
        attributes: ["purchase_order_item_id"],
        transaction: trx,
        raw: true,
      });

      const poItemIds = [...new Set(items.map(x => Number(x.purchase_order_item_id)).filter(Boolean))];

      if (!poItemIds.length) {
        await trx.commit();
        return res.json({ success: true, message: "No items assigned", inspection_id: null, item_inspections: [] });
      }

      const poItemRows = await PurchaseOrderItem.findAll({
        where: { id: { [Op.in]: poItemIds } },
        attributes: ["id", "po_id"],
        transaction: trx,
        raw: true,
      });

      const poIdByItem = new Map(
        poItemRows
          .map((row) => [Number(row.id), Number(row.po_id)])
          .filter(([id, po_id]) => Number.isFinite(id) && Number.isFinite(po_id))
      );

      const candidatePoIds = [...new Set(
        [...poIdByItem.values(), casePoId].filter((v) => Number.isFinite(v) && v > 0)
      )];

      const existingPos = candidatePoIds.length
        ? await PurchaseOrder.findAll({
          where: { id: { [Op.in]: candidatePoIds } },
          attributes: ["id"],
          transaction: trx,
          raw: true,
        })
        : [];

      const validPoIds = new Set(existingPos.map((row) => Number(row.id)));

      const finalPoIdCandidate = poIdByItem.get(poItemIds[0]) ||
        (Number.isFinite(casePoId) && casePoId > 0 ? casePoId : null);
      const finalPoId = validPoIds.has(Number(finalPoIdCandidate)) ? Number(finalPoIdCandidate) : null;

      const item_inspections = [];
      let firstInspectionId = null;

      for (const poItemId of poItemIds) {
        const primaryPoId = poIdByItem.get(poItemId);
        const itemPoId = validPoIds.has(Number(primaryPoId))
          ? Number(primaryPoId)
          : finalPoId;

        if (!itemPoId) {
          await trx.rollback();
          return res.status(409).json({
            success: false,
            message: `Assigned item ${poItemId} is linked to missing PO. Please reassign inspector from valid PO.`
          });
        }

        const insp = await upsertItemInspection({
          caseId,
          poId: itemPoId,
          poItemId,
          assignmentId: asg.id,
          inspectorId: req.user.id,
          inspection_location: asg.inspection_location,
          schedule_datetime: asg.scheduled_on,
          assigned_by: asg.assigned_by ?? null,
          trx,
        });

        // mark in_progress when inspector starts
        if (insp.status === "assigned") {
          await insp.update({ status: "in_progress" }, { transaction: trx });
        }

        if (!firstInspectionId) firstInspectionId = insp.id;

        item_inspections.push({
          purchase_order_item_id: poItemId,
          inspection_id: insp.id,
        });

        // event
        await InspectionEvent.create(
          {
            inspection_id: insp.id,
            po_id: itemPoId,
            actor_user_id: req.user.id,
            type: "start_inspection",
            note: `Started item ${poItemId}`,
          },
          { transaction: trx }
        );
      }

      await trx.commit();

      return res.json({
        success: true,
        message: "Inspection started/resumed (per item).",
        inspection_id: firstInspectionId, // Android backward compatibility
        assignment_id: asg.id,
        po_id: finalPoId,
        item_inspections,
      });

    } catch (e) {
      if (trx) await trx.rollback();
      console.error("startInspection:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
  // inspectionsController.js

  static getStagesCount = async (req, res) => {
    const { poId } = req.params;
    const { batch_id } = req.query;

    try {
      if (!batch_id) {
        return res.status(400).json({ success: false, message: "batch_id is required" });
      }

      const batchId = Number(batch_id);
      if (!Number.isFinite(batchId)) {
        return res.status(400).json({ success: false, message: "Invalid batch_id" });
      }

      // ================= INSPECTION =================
      const inspection = await Inspection.findOne({
        where: { po_id: poId },
        include: [
          {
            model: PurchaseOrder,
            attributes: ["po_number"],
            include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
          },
        ],
        raw: true,
        nest: true,
      });

      if (!inspection) {
        return res.status(404).json({ success: false, message: "Inspection not found" });
      }

      const inspectionId = inspection.id;

      // ================= VALIDATE BATCH =================
      const batch = await InspectionBatch.findByPk(batchId);
      if (!batch) {
        return res.status(400).json({ success: false, message: "Invalid batch for this inspection" });
      }

      // ================= ONLY STARTED STAGES FOR THIS BATCH =================
      // IMPORTANT: Only stages where PoStage exists => means stage started at least once
      const poStages = await PoStage.findAll({
        where: {
          inspection_id: inspectionId,
          batch_id: batchId,
        },
        raw: true,
      });

      if (!poStages.length) {
        // Fresh batch: stage list should be empty as per requirement
        return res.json({
          success: true,
          data: {
            po_number: inspection.purchase_order?.po_number || null,
            vendor_name: inspection.purchase_order?.Vendor?.vendor_name || null,
            batch_id: batchId,
            batch_quantity: Number(batch.selected_quantity || 0),
            batch_status: batch.status,
            stages: [],
          },
        });
      }

      const stageIds = [...new Set(poStages.map(ps => Number(ps.stage_id)).filter(Boolean))];

      const stagesMaster = await Stage.findAll({
        where: { id: { [Op.in]: stageIds } },
        order: [["id", "ASC"]],
        raw: true,
      });

      const stageTests = await StageTest.findAll({
        where: {
          inspection_id: inspectionId,
          batch_id: batchId,
        },
        raw: true,
      });

      const stageData = stagesMaster.map((stage) => {
        const poStage = poStages.find(ps => Number(ps.stage_id) === Number(stage.id));
        const poStageId = poStage?.id ?? null;

        const testsForStage = poStageId
          ? stageTests.filter(t => Number(t.po_stage_id) === Number(poStageId))
          : [];

        const completedTests = testsForStage.filter(t => t.result === "pass" || t.result === "fail").length;

        return {
          stage_id: stage.id,
          stage_name: stage.stage_name,
          description: stage.description,
          status: poStage?.status || "pending", // should not be pending since poStage exists
          total_tests: testsForStage.length,
          completed_tests: completedTests,
        };
      });

      return res.json({
        success: true,
        data: {
          po_number: inspection.purchase_order?.po_number || null,
          vendor_name: inspection.purchase_order?.Vendor?.vendor_name || null,
          batch_id: batchId,
          batch_quantity: Number(batch.selected_quantity || 0),
          batch_status: batch.status,
          stages: stageData,
        },
      });

    } catch (err) {
      console.error("getStagesCount ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };

  static getPOListForInspector = async (req, res) => {
    try {
      const inspector_id = Number(req.user?.id || 0);
      const scopeToInspector =
        !isAdminUser(req) && Number.isFinite(inspector_id) && inspector_id > 0;
      const targetDate = toYmd(new Date());

      const assignmentWhere = {
        status: { [Op.in]: ["active", "rescheduled", "assigned", "in_process"] },
      };

      if (scopeToInspector) {
        assignmentWhere.inspector_id = inspector_id;
        const dayStart = new Date(`${targetDate}T00:00:00`);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        assignmentWhere.scheduled_on = {
          [Op.gte]: dayStart,
          [Op.lt]: dayEnd,
        };
      }

      const data = await PurchaseOrder.findAll({
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: PurchaseOrderItem,
            attributes: ["id", "quantity"],
            include: [{ model: Items, attributes: ["id", "item_name"] }],
          },
          { model: Vendor },
          {
            model: InspectionCase,
            as: "InspectionCases",
            required: scopeToInspector,
            include: [
              {
                model: InspectionAssignment,
                as: "Assignments",
                required: scopeToInspector,
                where: assignmentWhere,
                include: [
                  { model: User, as: "Inspector", attributes: ["id", "name", "email"] },
                  {
                    model: InspectionAssignmentItem,
                    as: "AssignmentItems",
                    where: { status: "active" },
                    required: false,
                    attributes: ["purchase_order_item_id"],
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = data.map((po) => {
        const poJson = po.toJSON();

        const poItems = poJson.purchase_order_items || [];
        const totalItems = poItems.length;

        const cases = poJson.InspectionCases || [];
        const assignments = cases.flatMap(c => c.Assignments || []);

        const assignedItemSet = new Set();
        const inspectorCountMap = new Map();

        for (const asn of assignments) {
          const inspector = asn.Inspector;
          const inspItems = asn.AssignmentItems || [];

          for (const ai of inspItems) {
            if (!ai.purchase_order_item_id) continue;

            assignedItemSet.add(Number(ai.purchase_order_item_id));

            if (inspector?.id) {
              if (!inspectorCountMap.has(inspector.id)) {
                inspectorCountMap.set(inspector.id, {
                  id: inspector.id,
                  name: inspector.name || inspector.email,
                  count: 0,
                });
              }
              inspectorCountMap.get(inspector.id).count += 1;
            }
          }
        }

        const assignedItems = assignedItemSet.size;
        const isFullyAssigned = totalItems > 0 && assignedItems === totalItems;
        const isPartiallyAssigned = assignedItems > 0 && assignedItems < totalItems;

        return {
          ...poJson,
          total_items: totalItems,
          assigned_items: assignedItems,
          is_fully_assigned: isFullyAssigned,
          is_partially_assigned: isPartiallyAssigned,
          isInspectorAssigned: assignedItems > 0,
          assigned_inspectors: Array.from(inspectorCountMap.values()),
          assigned_inspectors_text:
            inspectorCountMap.size > 0
              ? Array.from(inspectorCountMap.values()).map((x) => `${x.name} (${x.count})`).join(", ")
              : "-",
        };
      });

      const filteredResult =
        scopeToInspector ? result.filter((po) => Number(po.assigned_items || 0) > 0) : result;

      res.json(filteredResult);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  };


  static async getPoItemDetails(req, res) {
    try {
      const inspector_id = Number(req.user?.id);
      const rawPoId = req.params?.poId;
      const poId =
        rawPoId === undefined || rawPoId === null || String(rawPoId).trim() === ""
          ? null
          : Number(rawPoId);

      if (rawPoId !== undefined && (!Number.isFinite(poId) || poId <= 0)) {
        return res.status(400).json({
          success: false,
          message: "Invalid poId",
        });
      }

      // If PO id is provided, treat this as PO-wise lookup (not current-inspector day list).
      const scopeToInspector = !poId;

      const assignmentWhere = {
        status: { [Op.in]: ["active", "rescheduled", "assigned", "in_process"] },
      };
      if (scopeToInspector) {
        const targetDate = toYmd(new Date());
        const dayStart = toDayStart(targetDate);
        const dayEnd = toDayEndExclusive(targetDate);
        assignmentWhere.inspector_id = inspector_id;
        if (dayStart && dayEnd) {
          assignmentWhere.scheduled_on = {
            [Op.gte]: dayStart,
            [Op.lt]: dayEnd,
          };
        }
      }

      const caseWhere = {};
      if (Number.isFinite(poId) && poId > 0) {
        caseWhere.po_id = poId;
      }

      const assignments = await InspectionAssignment.findAll({
        where: assignmentWhere,
        include: [
          {
            association: "Case",
            required: true,
            where: caseWhere,
            include: [
              {
                association: "PurchaseOrder",
                attributes: { exclude: ["project_id"] },
                include: [{ model: Vendor, attributes: ["id", "vendor_name"] }],
              },
            ],
          },
        ],
        order: [["id", "DESC"]],
      });

      if (!assignments.length) {
        return res.status(200).json({
          success: true,
          po_number: null,
          vendor_name: null,
          project_name: null,
          design_ref: null,
          design_copy: null,
          attachment: null,
          design_document: null,
          po_document: null,
          inspector_id,
          assignment_id: null,
          case_id: null,
          items: [],
        });
      }

      const assignmentIds = assignments.map((a) => Number(a.id)).filter(Boolean);
      const assignmentMeta = new Map();
      for (const asg of assignments) {
        const po = asg?.Case?.PurchaseOrder || null;
        const poAttachments = normalizePoAttachments(po?.attachment);
        const poDesignCopies = normalizePoDesignCopies(po?.design_copy);
        assignmentMeta.set(Number(asg.id), {
          assignment: asg,
          caseId: Number(asg.case_id) || null,
          poId: Number(po?.id || asg?.Case?.po_id || 0) || null,
          poNumber: po?.po_number || null,
          vendorName: po?.Vendor?.vendor_name || null,
          projectName: po?.project_name || null,
          designRef: po?.design_ref || null,
          designCopy: poDesignCopies.design_copy,
          designCopies: poDesignCopies.design_copies,
          attachment: poAttachments.attachment,
          attachments: poAttachments.attachments,
        });
      }

      const allAssignmentItems = await InspectionAssignmentItem.findAll({
        where: {
          assignment_id: { [Op.in]: assignmentIds },
          status: "active",
        },
        include: [
          {
            association: "PoItem",
            required: true,
            include: [{ model: Items, required: false }],
          },
        ],
        order: [
          ["assignment_id", "DESC"],
          ["id", "DESC"],
        ],
      });

      const assignmentItems = allAssignmentItems.filter((ai) => {
        if (!poId) {
          return true;
        }
        const itemPoId = Number(ai?.PoItem?.po_id);
        return Number.isFinite(itemPoId) && itemPoId === poId;
      });

      inspectionDebug("getPoItemDetails.assignment_items_fetched", {
        all_count: allAssignmentItems.length,
        filtered_count: assignmentItems.length,
      });

      const firstAssignmentId = Number(assignmentItems[0]?.assignment_id || assignments[0]?.id || 0) || null;
      const firstMeta = firstAssignmentId ? assignmentMeta.get(firstAssignmentId) : null;

      if (!assignmentItems.length) {
        inspectionDebug("getPoItemDetails.no_assignment_items", {
          po_id: poId,
          first_assignment_id: firstAssignmentId,
        });
        return res.status(200).json({
          success: true,
          po_number: poId ? firstMeta?.poNumber || null : null,
          vendor_name: poId ? firstMeta?.vendorName || null : null,
          project_name: poId ? firstMeta?.projectName || null : null,
          design_ref: poId ? firstMeta?.designRef || null : null,
          design_copy: poId ? firstMeta?.designCopy || null : null,
          design_copies: poId ? firstMeta?.designCopies || [] : [],
          attachment: poId ? firstMeta?.attachment || null : null,
          attachments: poId ? firstMeta?.attachments || [] : [],
          design_document: poId ? firstMeta?.designCopy || null : null,
          po_document: poId ? firstMeta?.attachment || null : null,
          inspector_id,
          assignment_id: poId ? firstAssignmentId : null,
          case_id: poId ? firstMeta?.caseId || null : null,
          items: [],
        });
      }

      const poItemIds = [...new Set(assignmentItems.map((ai) => Number(ai?.PoItem?.id)).filter(Boolean))];
      const caseIds = [
        ...new Set(
          assignmentItems
            .map((ai) => Number(assignmentMeta.get(Number(ai.assignment_id))?.caseId))
            .filter(Boolean)
        ),
      ];

      const inspections = await Inspection.findAll({
        where: {
          ...(scopeToInspector ? { inspector_id } : {}),
          assignment_id: { [Op.in]: assignmentIds },
          case_id: { [Op.in]: caseIds },
          purchase_order_item_id: { [Op.in]: poItemIds },
        },
        order: [["id", "DESC"]],
        raw: true,
      });
      const initialInspectionCount = inspections.length;

      const inspectionByAssignmentAndItem = {};
      for (const row of inspections) {
        const key = `${Number(row.assignment_id)}_${Number(row.purchase_order_item_id)}`;
        if (!inspectionByAssignmentAndItem[key]) {
          inspectionByAssignmentAndItem[key] = row;
        }
      }

      let upsertedInspectionCount = 0;
      for (const ai of assignmentItems) {
        const assignmentId = Number(ai.assignment_id);
        const poItemId = Number(ai?.PoItem?.id);
        if (!assignmentId || !poItemId) {
          continue;
        }

        const key = `${assignmentId}_${poItemId}`;
        if (inspectionByAssignmentAndItem[key]) {
          continue;
        }

        const meta = assignmentMeta.get(assignmentId);
        const asg = meta?.assignment;
        const itemPoId = Number(ai?.PoItem?.po_id || meta?.poId || 0);
        const itemCaseId = Number(meta?.caseId || 0);

        if (!itemPoId || !itemCaseId) {
          continue;
        }

        const insp = await upsertItemInspection({
          caseId: itemCaseId,
          poId: itemPoId,
          poItemId,
          assignmentId,
          inspectorId: scopeToInspector
            ? inspector_id
            : Number(asg?.inspector_id || inspector_id || 0) || null,
          inspection_location: asg?.inspection_location ?? null,
          schedule_datetime: asg?.scheduled_on ?? null,
          assigned_by: asg?.assigned_by ?? null,
          trx: null,
        });

        if (insp) {
          inspectionByAssignmentAndItem[key] = typeof insp.toJSON === "function" ? insp.toJSON() : insp;
          upsertedInspectionCount += 1;
        }
      }

      inspectionDebug("getPoItemDetails.inspections_summary", {
        initial_count: initialInspectionCount,
        upserted_count: upsertedInspectionCount,
        final_pairs: Object.keys(inspectionByAssignmentAndItem).length,
      });

      const inspectionIds = Object.values(inspectionByAssignmentAndItem)
        .map((x) => Number(x.id))
        .filter(Boolean);

      const batches = inspectionIds.length
        ? await InspectionBatch.findAll({
          where: {
            inspection_id: { [Op.in]: inspectionIds },
            purchase_order_item_id: { [Op.in]: poItemIds },
            status: { [Op.ne]: "cancelled" },
          },
          raw: true,
        })
        : [];

      const items = assignmentItems.map((ai) => {
        const assignmentId = Number(ai.assignment_id);
        const meta = assignmentMeta.get(assignmentId) || {};
        const poItem = ai.PoItem;
        const poItemId = Number(poItem?.id);
        const totalQty = Number(poItem?.quantity || 0);
        const itemPoId = Number(poItem?.po_id || meta.poId || 0) || null;

        const inspKey = `${assignmentId}_${poItemId}`;
        const insp = inspectionByAssignmentAndItem[inspKey] || null;
        const inspectionId = Number(insp?.id || 0) || null;

        const itemBatches = inspectionId
          ? batches.filter(
            (b) =>
              Number(b.purchase_order_item_id) === poItemId &&
              Number(b.inspection_id) === inspectionId
          )
          : [];

        const alreadySelected = itemBatches.reduce(
          (s, b) => s + Number(b.selected_quantity || 0),
          0
        );

        const remainingSelectable = Math.max(totalQty - alreadySelected, 0);
        const activeBatch = itemBatches.find((b) => b.status === "active") || null;
        const effectiveInspectionStatus = String(
          insp?.status || meta.assignment?.status || "assigned",
        )
          .trim()
          .toLowerCase();
        const scheduledOn = insp?.schedule_datetime || meta.assignment?.scheduled_on || null;
        const isCancelled = effectiveInspectionStatus === "cancelled";
        const isRejected = effectiveInspectionStatus === "rejected";
        const isCompleted = effectiveInspectionStatus === "completed";
        const canMutateItem = !isCancelled && !isRejected && !isCompleted;

        const batches_info = itemBatches.map((b) => ({
          batch_id: b.id,
          selected_quantity: Number(b.selected_quantity || 0),
          status: b.status,
          result: b.result ?? null,
        }));

        return {
          assignment_id: assignmentId,
          case_id: Number(meta.caseId || 0) || null,
          po_id: itemPoId,
          po_number: meta.poNumber || null,
          vendor_name: meta.vendorName || null,
          project_name: meta.projectName || null,
          design_ref: meta.designRef || null,
          design_copy: meta.designCopy || null,
          design_copies: meta.designCopies || [],
          attachment: meta.attachment || null,
          attachments: meta.attachments || [],
          design_document: meta.designCopy || null,
          po_document: meta.attachment || null,
          purchase_order_item_id: poItemId,
          item_master_id: poItem?.Item?.id || poItem?.item_id || null,
          item_name: poItem?.Item?.item_name || poItem?.Items?.item_name || "Unknown",
          total_quantity: totalQty,
          inspector_id: Number(insp?.inspector_id || meta.assignment?.inspector_id || 0) || null,
          inspection_id: inspectionId,
          inspection_status: effectiveInspectionStatus || null,
          assignment_status: meta.assignment?.status || null,
          inspection_date: scheduledOn,
          scheduled_on: scheduledOn,
          batches_info,
          already_selected_quantity: alreadySelected,
          remaining_selectable_quantity: remainingSelectable,
          active_batch_id: activeBatch?.id || null,
          active_batch_selected_quantity: activeBatch?.selected_quantity || null,
          stage_status: isCancelled
            ? "cancelled"
            : isRejected
              ? "rework"
              : isCompleted
                ? "completed"
                : effectiveInspectionStatus === "in_progress"
                  ? "in_progress"
                  : effectiveInspectionStatus === "rescheduled"
                    ? "rescheduled"
                    : "pending",
          test_status: isCancelled
            ? "cancelled"
            : isRejected
              ? "rejected"
              : (remainingSelectable === 0 || isCompleted)
                ? "completed"
                : effectiveInspectionStatus === "in_progress"
                  ? "in_progress"
                  : effectiveInspectionStatus === "rescheduled"
                    ? "rescheduled"
                    : "pending",
          can_reschedule: canMutateItem,
          can_cancel: canMutateItem,
          can_reject: canMutateItem,
          is_cancelled: isCancelled,
          is_rejected: isRejected,
          completed_test_quantity: 0,
          pending_test_quantity: totalQty,
        };
      });

      inspectionDebug("getPoItemDetails.response", {
        item_count: items.length,
        assignment_id: poId ? firstAssignmentId : null,
        case_id: poId ? firstMeta?.caseId || null : null,
        po_number: poId ? firstMeta?.poNumber || null : null,
      });

      return res.status(200).json({
        success: true,
        po_number: poId ? firstMeta?.poNumber || null : null,
        vendor_name: poId ? firstMeta?.vendorName || null : null,
        project_name: poId ? firstMeta?.projectName || null : null,
        design_ref: poId ? firstMeta?.designRef || null : null,
        design_copy: poId ? firstMeta?.designCopy || null : null,
        design_copies: poId ? firstMeta?.designCopies || [] : [],
        attachment: poId ? firstMeta?.attachment || null : null,
        attachments: poId ? firstMeta?.attachments || [] : [],
        design_document: poId ? firstMeta?.designCopy || null : null,
        po_document: poId ? firstMeta?.attachment || null : null,
        inspector_id,
        assignment_id: poId ? firstAssignmentId : null,
        case_id: poId ? firstMeta?.caseId || null : null,
        items,
      });
    } catch (error) {
      inspectionDebug("getPoItemDetails.error", {
        message: error?.message || String(error),
      });
      console.error("getPoItemDetails ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  // inspectionsController.js
  static async getStagesWorkspace(req, res) {
    try {
      const inspectionId = Number(req.params.inspection_id);
      const batchId = Number(req.query.batch_id);
      const poItemId = Number(req.query.item_id);
      console.log("getStagesWorkspace called with inspectionId:", inspectionId, "batchId:", batchId, "poItemId:", poItemId);
      if (![inspectionId, batchId, poItemId].every(Number.isFinite)) {
        return res.status(400).json({ success: false, message: "Invalid params" });
      }

      // validate inspection
      const inspection = await Inspection.findByPk(inspectionId, {
        include: [
          {
            model: PurchaseOrder,
            attributes: ["po_number"],
            include: [{ model: Vendor, attributes: ["vendor_name"] }],
          },
        ],
      });

      if (!inspection) {
        return res.status(404).json({ success: false, message: "Inspection not found" });
      }

      // validate batch belongs to same inspection + item
      const batch = await InspectionBatch.findByPk(batchId);
      if (!batch) return res.status(400).json({ success: false, message: "Batch not found" });

      if (Number(batch.inspection_id) !== inspectionId || Number(batch.purchase_order_item_id) !== poItemId) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch (inspection/item mismatch)",
        });
      }

      // master stages (always 5 etc)
      const stagesMaster = await Stage.findAll({
        order: [["id", "ASC"]],
        raw: true,
      });

      // started stage rows (PoStage exists => started once)
      const poStages = await PoStage.findAll({
        where: { inspection_id: inspectionId, batch_id: batchId, item_id: poItemId },
        raw: true,
      });

      // stage tests results for this item+batch
      const stageTests = await StageTest.findAll({
        where: { inspection_id: inspectionId, batch_id: batchId, item_id: poItemId },
        raw: true,
      });

      const normalize = (s) => {
        if (!s) return "pending";
        const v = String(s).trim().toLowerCase().replace(/\s+/g, "_");
        if (v === "in_progress" || v === "inprogress" || v === "in_progresss") return "in_progress";
        if (v === "completed") return "completed";
        if (v === "rework" || v === "failed") return "rework";
        if (v === "pending") return "pending";
        return v;
      };

      const poStageByStageId = {};
      for (const ps of poStages) poStageByStageId[Number(ps.stage_id)] = ps;

      const testsByPoStageId = {};
      for (const t of stageTests) {
        const pid = Number(t.po_stage_id);
        if (!testsByPoStageId[pid]) testsByPoStageId[pid] = [];
        testsByPoStageId[pid].push(t);
      }

      const safeDocsCount = (rows) => {
        let c = 0;
        for (const r of rows) {
          let docs = r.documents;
          if (typeof docs === "string") {
            try { docs = JSON.parse(docs); } catch { docs = []; }
          }
          if (Array.isArray(docs)) c += docs.length;
        }
        return c;
      };

      const stageData = stagesMaster.map((st) => {
        const stageId = Number(st.id);
        const ps = poStageByStageId[stageId] || null;
        const poStageId = ps ? Number(ps.id) : null;

        const rows = poStageId ? (testsByPoStageId[poStageId] || []) : [];

        // completed_tests: distinct test_ids jinke latest result pass/fail/rework aaya ho
        const latestByTest = {};
        for (const r of rows) latestByTest[Number(r.test_id)] = r;

        let completedTests = 0;
        let failReports = 0;

        for (const tid of Object.keys(latestByTest)) {
          const lr = latestByTest[tid];
          const result = String(lr.result || "").toLowerCase();
          if (result === "pass" || result === "fail" || result === "rework" || result === "reject") completedTests++;
          if (result === "fail" || result === "rework" || result === "reject") failReports++;
        }

        // total_tests: best fallback
        const totalTests =
          Number(st.total_tests || 0) > 0 ? Number(st.total_tests) : Math.max(Object.keys(latestByTest).length, 0);

        return {
          stage_id: stageId,
          stage_name: st.stage_name || `Stage ${stageId}`,
          status: normalize(ps?.status),
          total_tests: totalTests,
          completed_tests: completedTests,
          reports_count: failReports,                // UI "Reports"
          docs_count: safeDocsCount(rows),           // UI "Docs"
          updated_at: ps?.updatedAt || ps?.updated_at || null,
        };
      });

      return res.json({
        success: true,
        data: {
          po_number: inspection?.PurchaseOrder?.po_number || null,
          vendor_name: inspection?.PurchaseOrder?.Vendor?.vendor_name || null,
          batch_id: batchId,
          batch_quantity: Number(batch.selected_quantity || 0),
          batch_status: batch.status,
          stages: stageData,
        },
      });

    } catch (e) {
      console.error("getStagesWorkspace:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }


  static reassignItems = async (req, res) => {
    const sequelize = InspectionAssignment.sequelize;
    let trx;

    try {
      const {
        from_assignment_id,
        to_inspector_id,
        item_ids = [],
        inspection_location,
        schedule_datetime,
        remarks,
        reason,
      } = req.body;

      if (!from_assignment_id || !to_inspector_id || !Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({ status: "error", message: "from_assignment_id, to_inspector_id, item_ids required" });
      }

      trx = await sequelize.transaction();

      const fromAsg = await InspectionAssignment.findByPk(Number(from_assignment_id), {
        transaction: trx,
        include: [{ association: "Case", required: true }],
      });

      if (!fromAsg) {
        await trx.rollback();
        return res.status(404).json({ status: "error", message: "From assignment not found" });
      }

      const caseId = Number(fromAsg.case_id);
      const poId = Number(fromAsg.Case?.po_id);

      // 1) old assignment items -> reassigned
      await InspectionAssignmentItem.update(
        { status: "reassigned", ended_at: new Date(), ended_by: req.user?.id ?? null },
        {
          where: {
            assignment_id: fromAsg.id,
            purchase_order_item_id: { [Op.in]: item_ids.map(Number) },
            status: "active",
          },
          transaction: trx,
        }
      );

      // 2) create new assignment for new inspector
      const newAsg = await InspectionAssignment.create(
        {
          case_id: caseId,
          inspector_id: Number(to_inspector_id),
          inspection_location: inspection_location || fromAsg.inspection_location,
          scheduled_on: schedule_datetime ? new Date(schedule_datetime) : fromAsg.scheduled_on,
          remarks: remarks ?? null,
          status: "active",
          assigned_by: req.user?.id ?? null,
        },
        { transaction: trx }
      );

      await InspectionAssignmentItem.bulkCreate(
        item_ids.map((x) => ({
          assignment_id: newAsg.id,
          purchase_order_item_id: Number(x),
          status: "active",
        })),
        { transaction: trx }
      );

      // If source assignment has no active items left, mark assignment as reassigned.
      const remainingActiveItems = await InspectionAssignmentItem.count({
        where: { assignment_id: fromAsg.id, status: "active" },
        transaction: trx,
      });
      if (remainingActiveItems === 0) {
        await fromAsg.update(
          {
            status: "reassigned",
            ended_at: new Date(),
            ended_by: req.user?.id ?? null,
          },
          { transaction: trx }
        );
      }

      // 3) If fromAsg has no active items left, mark it ended
      const remaining = await InspectionAssignmentItem.count({
        where: { assignment_id: fromAsg.id, status: "active" },
        transaction: trx,
      });

      if (remaining === 0) {
        await fromAsg.update(
          { status: "reassigned", ended_at: new Date(), ended_by: req.user?.id ?? null },
          { transaction: trx }
        );
      }

      // âœ… 4) CRITICAL: move/attach inspections to new assignment+inspector (history preserved)
      for (const poItemId of item_ids.map(Number)) {
        await upsertItemInspection({
          caseId,
          poId,
          poItemId,
          assignmentId: newAsg.id,
          inspectorId: Number(to_inspector_id),
          inspection_location: inspection_location || fromAsg.inspection_location,
          schedule_datetime: schedule_datetime ? new Date(schedule_datetime) : fromAsg.scheduled_on,
          assigned_by: req.user?.id ?? null,
          trx,
        });
      }

      // 5) event log
      await InspectionEvent.create(
        {
          case_id: caseId,
          assignment_id: newAsg.id,
          po_id: poId,
          actor_user_id: req.user?.id ?? null,
          type: "reassign_inspector",
          note: reason ?? "Items reassigned",
          before: { from_assignment_id: fromAsg.id, from_inspector_id: fromAsg.inspector_id, item_ids },
          after: { to_assignment_id: newAsg.id, to_inspector_id: Number(to_inspector_id), item_ids },
        },
        { transaction: trx }
      );

      await trx.commit();
      return res.json({ status: "success", message: "Items reassigned (history preserved)", data: { new_assignment_id: newAsg.id } });

    } catch (e) {
      if (trx) await trx.rollback();
      console.error("reassignItems:", e);
      return res.status(500).json({ status: "error", message: "Server error" });
    }
  };
  // inspectionsController.js
  static async getUpcomingInspections(req, res) {
    try {
      const inspector_id = req.user.id;

      const upcoming = await InspectionAssignment.findAll({
        where: {
          inspector_id,
          status: { [Op.in]: ["assigned", "active", "rescheduled"] },
          scheduled_on: {
            [Op.gte]: new Date(),
            [Op.lte]: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
          }
        },
        include: [{
          association: "Case",
          include: [{
            association: "PurchaseOrder",
            attributes: { exclude: ["project_id"] },
            include: [{ model: Vendor, attributes: ["vendor_name"] }]
          }]
        }],

        order: [["scheduled_on", "ASC"]]
      });
      console.log("gggggggggggg" + upcoming)
      const result = upcoming.map(a => ({
        assignment_id: a.id,
        po_id: a.Case?.PurchaseOrder?.id,
        po_number: a.Case?.PurchaseOrder?.po_number,
        vendor: a.Case?.PurchaseOrder?.Vendor?.vendor_name,
        scheduled_on: a.scheduled_on,
        inspection_location: a.inspection_location
      }));

      res.json({ success: true, data: result });

    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async getRecentActivity(req, res) {
    try {
      const inspector_id = req.user.id;

      // âœ… Latest StageTest Reports (Pass/Fail)
      const reports = await StageTest.findAll({
        where: {
          inspector_id: inspector_id
        },

        include: [
          // âœ… Inspection â†’ PO â†’ Vendor
          {
            model: Inspection,
            attributes: ["id", "po_id", "purchase_order_item_id"],
            include: [
              {
                model: PurchaseOrder,
                attributes: ["id", "po_number"],
                include: [
                  {
                    model: Vendor,
                    attributes: ["vendor_name"]
                  }
                ]
              }
            ]
          },

          // ✅ Item Name (from PO Item)
          {
            model: PurchaseOrderItem,
            attributes: ["id", "po_id", "item_id"],
            include: [{ model: Items, attributes: ["item_name"] }]
          },

          // âœ… Stage Name
          {
            model: Stage,
            attributes: ["id", "stage_name"]
          },

          // âœ… Test Name
          {
            model: Test,
            attributes: ["id", "test_name"]
          }
        ],

        order: [["updatedAt", "DESC"], ["id", "DESC"]],
        limit: 5,
        logging: console.log // for debugging, remove in production
      });

      const poStageIds = [
        ...new Set(
          reports
            .map((r) => Number(r.po_stage_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        ),
      ];

      const poStageRows = poStageIds.length
        ? await PoStage.findAll({
            where: { id: { [Op.in]: poStageIds } },
            include: [{ model: Stage, attributes: ["stage_name"] }],
            attributes: ["id", "stage_id"],
          })
        : [];

      const stageNameByPoStageId = new Map(
        poStageRows.map((row) => [Number(row.id), row?.Stage?.stage_name || null]),
      );
      const stageIdByPoStageId = new Map(
        poStageRows.map((row) => [Number(row.id), Number(row.stage_id || 0) || null]),
      );

      // âœ… Format Response
      const result = reports.map(r => ({
        inspection_id: Number(r.inspection_id || r?.Inspection?.id || 0) || null,
        po_id: Number(
          r?.Inspection?.po_id
            || r?.Inspection?.PurchaseOrder?.id
            || r?.PurchaseOrderItem?.po_id
            || 0
        ) || null,
        purchase_order_item_id: Number(
          r?.item_id
            || r?.Inspection?.purchase_order_item_id
            || r?.PurchaseOrderItem?.id
            || 0
        ) || null,
        batch_id: Number(r.batch_id || 0) || null,
        stage_id: Number(
          r?.stage_id
            || r?.Stage?.id
            || stageIdByPoStageId.get(Number(r.po_stage_id))
            || 0
        ) || null,
        test_id: Number(r?.test_id || r?.Test?.id || 0) || null,

        po_number: r?.Inspection?.PurchaseOrder?.po_number
          || r?.Inspection?.PO?.po_number
          || r?.PurchaseOrderItem?.PurchaseOrder?.po_number
          || "-",
        vendor_name: r?.Inspection?.PurchaseOrder?.Vendor?.vendor_name
          || r?.Inspection?.PO?.Vendor?.vendor_name
          || r?.PurchaseOrderItem?.PurchaseOrder?.Vendor?.vendor_name
          || "-",
        item_name: r?.PurchaseOrderItem?.Item?.item_name
          || r?.PurchaseOrderItem?.Items?.item_name
          || "-",

        stage_name:
          r.Stage?.stage_name ||
          stageNameByPoStageId.get(Number(r.po_stage_id)) ||
          "Stage",
        test_name: r.Test?.test_name || "Test",

        result: r.result,
        status: r.status,
        quantity: r.quantity,

        report_documents: Array.isArray(r.documents)
          ? r.documents
          : (() => {
              if (!r.documents || typeof r.documents !== "string") return [];
              try {
                const parsed = JSON.parse(r.documents);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })(),

        inspection_date: resolveStageTestReportedOn(r),
        time: resolveStageTestReportedOn(r) || r.createdAt || null,
      }));
      return res.json({
        success: true,
        data: result
      });

    } catch (e) {
      console.error("getRecentActivity ERROR:", e);
      return res.status(500).json({
        success: false,
        message: "Server error: " + e.message
      });
    }
  }

  static async getLastInspectionDetails(req, res) {
    try {
      const inspectorId = Number(req.user?.id);
      if (!Number.isFinite(inspectorId)) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const latestInspection = await Inspection.findOne({
        where: { inspector_id: inspectorId },
        include: [
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "project_name"],
            include: [
              {
                model: Company,
                as: "Companies",
                through: { attributes: [] },
                attributes: [
                  "id",
                  "company_name",
                  "registered_address",
                  "city",
                  "state",
                  "pin",
                  "logo",
                ],
              },
            ],
          },
          {
            model: PurchaseOrderItem,
            as: "PoItem",
            attributes: ["id", "item_id", "quantity"],
            include: [{ model: Items, attributes: ["id", "item_name"] }],
          },
        ],
        order: [
          ["schedule_datetime", "DESC"],
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      });

      if (!latestInspection) {
        return res.json({
          success: true,
          message: "No inspection found for this inspector",
          data: null,
        });
      }

      const inspectionId = Number(latestInspection.id);
      const poItemId = Number(latestInspection.purchase_order_item_id || 0) || null;

      const poStageWhere = { inspection_id: inspectionId };
      const stageTestWhere = { inspection_id: inspectionId };
      if (poItemId) {
        poStageWhere.item_id = poItemId;
        stageTestWhere.item_id = poItemId;
      }

      const [poStages, stageTests] = await Promise.all([
        PoStage.findAll({
          where: poStageWhere,
          include: [{ model: Stage, attributes: ["id", "stage_name"] }],
          order: [["id", "ASC"]],
        }),
        StageTest.findAll({
          where: stageTestWhere,
          include: [
            { model: Stage, attributes: ["id", "stage_name"] },
            { model: Test, attributes: ["id", "test_name"] },
            {
              model: PurchaseOrderItem,
              attributes: ["id", "item_id", "quantity"],
              include: [{ model: Items, attributes: ["id", "item_name"] }],
            },
          ],
          order: [
            ["createdAt", "ASC"],
            ["id", "ASC"],
          ],
        }),
      ]);

      const stageMap = new Map();
      for (const row of poStages) {
        const stageId = Number(row.stage_id || row.Stage?.id || 0);
        if (!stageId) continue;

        stageMap.set(stageId, {
          stage_id: stageId,
          stage_name: row.Stage?.stage_name || `Stage ${stageId}`,
          stage_status: normalizeStageStatus(row.status),
          stage_result: normalizeStageResult(row.result),
          tests: [],
          stage_remarks: [],
          uploaded_documents: [],
          updated_at: row.updatedAt || null,
        });
      }

      for (const row of stageTests) {
        const stageId = Number(row.stage_id || row.Stage?.id || 0);
        if (!stageId) continue;

        if (!stageMap.has(stageId)) {
          stageMap.set(stageId, {
            stage_id: stageId,
            stage_name: row.Stage?.stage_name || `Stage ${stageId}`,
            stage_status: "in_progress",
            stage_result: null,
            tests: [],
            stage_remarks: [],
            uploaded_documents: [],
            updated_at: row.updatedAt || row.createdAt || null,
          });
        }

        const stagePayload = stageMap.get(stageId);
        const docs = normalizeDocuments(row.documents);
        const testResult = normalizeStageResult(row.result);
        const testStatus = normalizeStageStatus(row.status || row.result || "pending");

        if (!stagePayload.stage_result && testResult) stagePayload.stage_result = testResult;
        if (stagePayload.stage_status === "pending" && testStatus !== "pending") {
          stagePayload.stage_status = testStatus;
        }

        if (row.remark && String(row.remark).trim()) {
          stagePayload.stage_remarks.push(String(row.remark).trim());
        }

        stagePayload.uploaded_documents.push(...docs);
        stagePayload.tests.push({
          stage_test_id: Number(row.id),
          test_id: Number(row.test_id),
          test_name: row.Test?.test_name || `Test ${row.test_id}`,
          result: testResult,
          status: testStatus,
          remark: row.remark || "",
          quantity: Number(row.quantity || 0),
          uploaded_documents: docs,
          created_at: row.createdAt || null,
        });
      }

      const stages = Array.from(stageMap.values())
        .map((stageRow) => {
          stageRow.stage_remarks = [...new Set(stageRow.stage_remarks)];
          stageRow.uploaded_documents = [...new Set(stageRow.uploaded_documents)];

          if (!stageRow.stage_result && stageRow.tests.length) {
            const latestTest = stageRow.tests[stageRow.tests.length - 1];
            stageRow.stage_result = latestTest.result || null;
          }

          if (stageRow.stage_result === "fail" && stageRow.stage_status !== "failed") {
            stageRow.stage_status = "failed";
          } else if (!stageRow.stage_result && stageRow.tests.length && stageRow.stage_status === "pending") {
            stageRow.stage_status = "in_progress";
          }

          return stageRow;
        })
        .sort((a, b) => a.stage_id - b.stage_id);

      const allUploadedDocuments = [
        ...new Set(stages.flatMap((s) => s.uploaded_documents || [])),
      ];

      const hasFail = stages.some((s) => s.stage_result === "fail" || s.stage_status === "failed");
      const hasPass = stages.length > 0 && stages.every((s) => s.stage_result === "pass");

      let inspectionResult = null;
      if (hasFail) inspectionResult = "fail";
      else if (hasPass || String(latestInspection.status || "").toLowerCase() === "completed") inspectionResult = "pass";

      const compactStages = stages.map((stage) => ({
        stage_name: stage.stage_name,
        stage_result: stage.stage_result,
        tests: (stage.tests || []).map((test) => ({
          test_name: test.test_name,
          result: test.result,
          uploaded_documents: test.uploaded_documents || [],
        })),
      }));

      return res.json({
        success: true,
        data: {
          inspection_id: inspectionId,
          inspection_result: inspectionResult,
          uploaded_test_documents: allUploadedDocuments,
          stages: compactStages,
        },
      });
    } catch (e) {
      console.error("getLastInspectionDetails:", e);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }

  static async rescheduleInspection(req, res) {
    const sequelize = Inspection.sequelize;
    let trx;

    try {
      const { inspection_id, schedule_datetime, reason } = req.body;
      inspectionDebug("rescheduleInspection.request", {
        user_id: req.user?.id ?? null,
        body: req.body,
      });

      if (!inspection_id || !reason || reason.trim() === "") {
        inspectionDebug("rescheduleInspection.validation_failed", {
          reason: "inspection_id and reason are required",
          inspection_id: inspection_id || null,
        });
        return res.status(400).json({
          status: "error",
          message: "inspection_id and reason are required"
        });
      }

      trx = await sequelize.transaction();

      const insp = await Inspection.findByPk(Number(inspection_id), { transaction: trx });
      if (!insp) {
        await trx.rollback();
        inspectionDebug("rescheduleInspection.not_found", {
          inspection_id: Number(inspection_id),
        });
        return res.status(404).json({
          status: "error",
          message: "Inspection not found"
        });
      }

      const before = {
        status: insp.status,
        schedule_datetime: insp.schedule_datetime ?? null,
        inspector_id: insp.inspector_id
      };

      const isReschedule = !!schedule_datetime;
      const nextScheduleDate = isReschedule ? toValidDate(schedule_datetime) : null;
      if (isReschedule && !nextScheduleDate) {
        await trx.rollback();
        return res.status(400).json({
          status: "error",
          message: "Valid schedule_datetime is required"
        });
      }

      const updatePayload = {
        remarks: reason || insp.remarks || null,
      };

      if (isReschedule) {
        updatePayload.status = "rescheduled";
        updatePayload.schedule_datetime = nextScheduleDate;
      } else {
        updatePayload.status = "cancelled";
      }

      inspectionDebug("rescheduleInspection.update_payload", {
        inspection_id: insp.id,
        before,
        update_payload: updatePayload,
      });

      if (isReschedule) {
        await syncInspectionAndAssignmentSchedule({
          inspection: insp,
          nextScheduleDate,
          reason,
          transaction: trx,
        });
      } else {
        await insp.update(updatePayload, { transaction: trx });
      }

      let assignmentItemUpdate = null;
      if (Number(insp.assignment_id || 0) > 0 && Number(insp.purchase_order_item_id || 0) > 0) {
        if (isReschedule) {
          const [affectedRows] = await InspectionAssignmentItem.update(
            { status: "active", ended_at: null, ended_by: null },
            {
              where: {
                assignment_id: Number(insp.assignment_id),
                purchase_order_item_id: Number(insp.purchase_order_item_id),
                status: "cancelled",
              },
              transaction: trx,
            }
          );
          assignmentItemUpdate = { action: "reopen_active", affected_rows: Number(affectedRows || 0) };
        } else {
          const [affectedRows] = await InspectionAssignmentItem.update(
            { status: "cancelled", ended_at: new Date(), ended_by: req.user?.id ?? null },
            {
              where: {
                assignment_id: Number(insp.assignment_id),
                purchase_order_item_id: Number(insp.purchase_order_item_id),
                status: "active",
              },
              transaction: trx,
            }
          );
          assignmentItemUpdate = { action: "mark_cancelled", affected_rows: Number(affectedRows || 0) };
        }
      }

      if (!isReschedule) {
        await InspectionBatch.update(
          { status: "cancelled", result: "fail" },
          {
            where: {
              inspection_id: insp.id,
              purchase_order_item_id: insp.purchase_order_item_id,
              status: { [Op.ne]: "completed" },
            },
            transaction: trx,
          }
        );
      }

      const after = {
        status: insp.status,
        schedule_datetime: insp.schedule_datetime ?? null,
        inspector_id: insp.inspector_id
      };

      await logInspectionEvent({
        inspection_id: insp.id,
        po_id: insp.po_id,
        actor_user_id: req.user?.id ?? null,
        type: isReschedule ? "reschedule_item" : "cancel_item",
        note: reason,
        before,
        after,
        transaction: trx
      });

      await trx.commit();

      inspectionDebug("rescheduleInspection.success", {
        inspection_id: insp.id,
        operation: isReschedule ? "reschedule" : "cancel",
        assignment_item_update: assignmentItemUpdate,
        after,
      });

      return res.json({
        status: "success",
        message: isReschedule
          ? "Inspection rescheduled successfully"
          : "Inspection cancelled successfully"
      });

    } catch (e) {
      if (trx) await trx.rollback();
      inspectionDebug("rescheduleInspection.error", {
        message: e?.message || String(e),
      });
      console.error("rescheduleInspection:", e);
      return res.status(500).json({
        status: "error",
        message: "Server error"
      });
    }
  }
  static async getPoTestsStatus(req, res) {
    try {
      const inspectionId = Number(req.params.inspection_id);
      const poItemId = Number(req.query.item_id);
      const batchId = Number(req.query.batch_id);

      const stageIdRaw = req.query.stage_id;
      const stageId =
        stageIdRaw === undefined || stageIdRaw === null || stageIdRaw === ""
          ? null
          : Number(stageIdRaw);
      console
      if (![inspectionId, poItemId, batchId].every(Number.isFinite)) {
        return res.status(400).json({ success: false, message: "inspection_id, item_id, batch_id required" });
      }
      if (stageId !== null && !Number.isFinite(stageId)) {
        return res.status(400).json({ success: false, message: "Invalid stage_id" });
      }

      // âœ… batch validate
      const batch = await InspectionBatch.findByPk(batchId, { raw: true });
      if (!batch) return res.status(400).json({ success: false, message: "Batch not found" });

      if (Number(batch.inspection_id) !== inspectionId || Number(batch.purchase_order_item_id) !== poItemId) {
        return res.status(400).json({ success: false, message: "Invalid batch (inspection/item mismatch)" });
      }

      const selectedQty = Number(batch.selected_quantity || 0);
      const publicBaseUrl = getPublicBaseUrl(req);

      // stage_id not selected => blank
      if (stageId === null) {
        return res.json({
          success: true,
          inspection_id: inspectionId,
          purchase_order_item_id: poItemId,
          batch_id: batchId,
          po_stage_id: null,
          stage_id: null,
          stage_status: "pending",
          selected_quantity: selectedQty,
          total_tests: 0,
          tests: [],
        });
      }

      // âœ… helpers
      const docsArr = (documents) => {
        if (!documents) return [];
        if (Array.isArray(documents)) return documents;
        if (typeof documents === "string") {
          try {
            const parsed = JSON.parse(documents);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const extractDocumentName = (entry, index) => {
        const fallback = `Document ${index + 1}`;
        if (!entry) return fallback;

        if (typeof entry === "object") {
          const namedValue =
            entry.name ??
            entry.originalname ??
            entry.fileName ??
            entry.filename ??
            null;
          if (namedValue) return String(namedValue).trim();
        }

        const rawValue =
          typeof entry === "string"
            ? entry
            : entry.url ?? entry.path ?? entry.file ?? entry.location ?? "";
        const cleanValue = String(rawValue || "").split("?")[0];
        const segments = cleanValue.split("/").filter(Boolean);
        return segments.length ? segments[segments.length - 1] : fallback;
      };

      const toDocumentDtos = (documents) =>
        docsArr(documents)
          .map((entry, index) => {
            if (!entry) return null;
            const rawUrl =
              typeof entry === "string"
                ? entry
                : entry.url ?? entry.path ?? entry.file ?? entry.location ?? null;
            const url = toPublicUrl(rawUrl, publicBaseUrl);
            if (!url) return null;
            return {
              name: extractDocumentName(entry, index),
              url,
            };
          })
          .filter(Boolean);

      const normalize = (s) => {
        if (!s) return "pending";
        const v = String(s).trim().toLowerCase().replace(/\s+/g, "_");
        if (v === "inprogress" || v === "in_progress") return "in_progress";
        if (v === "completed") return "completed";
        if (v === "rework" || v === "failed") return "rework";
        return v;
      };

      const getDesignDocsFromTest = (tm) => {
        const raw =
          tm.design_documents ??
          tm.design_document ??
          tm.design_docs ??
          tm.design_doc ??
          tm.design ??
          null;

        if (!raw) return [];
        if (Array.isArray(raw)) return raw;

        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [raw];
          } catch {
            return [raw];
          }
        }
        return [];
      };

      /* =========================
         âœ… CATEGORY = ITEM SE
         PurchaseOrderItem -> Items -> Category
      ========================= */
      let category_name = "";

      const poItem = await PurchaseOrderItem.findByPk(poItemId, { raw: true });
      const itemMasterId = Number(poItem?.item_id || 0);

      if (itemMasterId) {
        // Items table me agar category_name direct store ho, toh ye use ho jayega
        const itemRow = await Items.findByPk(itemMasterId, { raw: true });

        if (itemRow?.category_name) {
          category_name = String(itemRow.category_name);
        } else if (itemRow?.category_id) {
          const cat = await Category.findByPk(Number(itemRow.category_id), { raw: true });
          category_name = cat?.category_name ? String(cat.category_name) : "";
        }
      }

      // âœ… PoStage item-wise
      const poStage = await PoStage.findOne({
        where: {
          inspection_id: inspectionId,
          batch_id: batchId,
          item_id: poItemId,
          stage_id: stageId,
        },
        raw: true,
      });

      const stage_status = normalize(poStage?.status || "pending");

      // âœ… Tests master (Test table)  (âŒ NO Category include)
      const testWhere = {};
      if (Test?.rawAttributes && ("stage_id" in Test.rawAttributes)) {
        testWhere.stage_id = stageId;
      }

      const testsMasterRows = await Test.findAll({
        where: testWhere,
        order: [["id", "ASC"]],
        raw: true,
      });

      // âœ… StageTest rows (agar stage start hua h tab)
      const stageTestRows = poStage
        ? await StageTest.findAll({
          where: {
            inspection_id: inspectionId,
            batch_id: batchId,
            item_id: poItemId,
            po_stage_id: Number(poStage.id),
          },
          order: [["id", "ASC"]],
          raw: true,
        })
        : [];

      // âœ… inspector map (name)
      const inspectorIds = [...new Set(stageTestRows.map((r) => Number(r.inspector_id)).filter(Boolean))];
      const users = inspectorIds.length
        ? await User.findAll({
          where: { id: { [Op.in]: inspectorIds } },
          attributes: ["id", "name", "email"],
          raw: true,
        })
        : [];

      const userMap = {};
      for (const u of users) userMap[Number(u.id)] = u.name || u.email || `User ${u.id}`;
      const testMasterById = {};
      for (const tm of ensureUniqueById(testsMasterRows)) {
        testMasterById[Number(tm.id)] = tm;
      }

      // âœ… SINGLE MERGED tests list
      const tests = ensureUniqueById(testsMasterRows).map((tm) => {
        const rows = stageTestRows.filter((r) => Number(r.test_id) === Number(tm.id));
        const lastRow = rows.length ? rows[rows.length - 1] : null;

        // qty sums
        const passQty = rows
          .filter((r) => String(r.result || "").toLowerCase() === "pass" && String(r.status || "").toLowerCase() !== "rework")
          .reduce((s, r) => s + Number(r.quantity || 0), 0);

        const failQty = rows
          .filter((r) => {
            const rs = String(r.result || "").toLowerCase();
            const st = String(r.status || "").toLowerCase();
            return rs === "fail" || rs === "reject" || st === "rework" || rs === "rework";
          })
          .reduce((s, r) => s + Number(r.quantity || 0), 0);

        // âœ… status + result (latest row driven for rework cycle)
        let status = "pending";
        let result = null;
        const lastResult = String(lastRow?.result || "").toLowerCase();
        const lastStatus = String(lastRow?.status || "").toLowerCase();

        if (rows.length === 0) {
          status = "pending";
          result = null;
        } else if (lastResult === "fail" || lastResult === "reject") {
          status = "failed";
          result = "fail";
        } else if (lastStatus === "rework") {
          status = "rework";
          result = lastResult === "pass" ? "pass" : null;
        } else if (selectedQty > 0 && passQty >= selectedQty) {
          status = "completed";
          result = "pass";
        } else if (passQty > 0) {
          status = "in_progress";
          result = null;
        }

        const design_documents = toDocumentDtos(getDesignDocsFromTest(tm));

        // âœ… IMPORTANT: report docs sab submissions se (not only lastRow)
        const report_documents = toDocumentDtos(rows.flatMap(r => docsArr(r.documents)));

        const inspectorId = pickLastNonEmptyValue(rows.map((r) => Number(r.inspector_id || 0) || ""));
        const inspector_name = inspectorId ? (userMap[Number(inspectorId)] || "") : "";
        const gps_location = pickLastNonEmptyValue(rows.map((r) => r.gps_location));
        const gps_human = gps_location || null;
        const description = rows
          .map((r) => String(r.description || "").trim())
          .filter(Boolean)
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(" | ");
        const remarks = rows
          .map((r) => String(r.remark || "").trim())
          .filter(Boolean)
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(" | ");

        return {
          id: Number(tm.id),
          test_name: tm.test_name || tm.name || `Test ${tm.id}`,

          status,           // pending | in_progress | completed | failed
          result,           // pass | fail | null

          pass_quantity: passQty,
          fail_quantity: failQty,

          design_documents,

          report_documents,
          docs_count: design_documents.length + report_documents.length,
          remarks: remarks || "",
          description: description || (tm.description || ""),

          inspector_name: rows.length ? inspector_name : "",
          gps_location: rows.length ? gps_location : null,
          gps_human: rows.length ? gps_human : null,
          reported_on: rows.length
            ? pickLastValidDate([
                ...rows.map((r) => r.inspection_date),
                ...rows.map((r) => r.updatedAt),
                ...rows.map((r) => r.createdAt),
              ]) || null
            : null,

          // âœ… category from item (same for all tests)
          category_name,

          instrument: tm.instrument || "",
          location: tm.location || "",
        };
      });

      const history_tests = stageTestRows.map((row) => {
        const tm = testMasterById[Number(row.test_id)] || {};
        const execution = mapStageTestExecution(row);
        const design_documents = toDocumentDtos(getDesignDocsFromTest(tm));
        const report_documents = toDocumentDtos(row.documents);

        return {
          id: Number(row.test_id || 0),
          history_id: Number(row.id || 0),
          test_name: tm.test_name || tm.name || `Test ${row.test_id}`,
          status: execution.status,
          result: execution.result,
          pass_quantity: execution.pass_quantity,
          fail_quantity: execution.fail_quantity,
          design_documents,
          report_documents,
          docs_count: design_documents.length + report_documents.length,
          remarks: String(row.remark || "").trim(),
          description: String(row.description || "").trim() || String(tm.description || "").trim(),
          inspector_name: row.inspector_id ? (userMap[Number(row.inspector_id)] || "") : "",
          gps_location: pickLastNonEmptyValue([row.gps_location]),
          gps_human: pickLastNonEmptyValue([row.gps_location]),
          reported_on: pickLastValidDate([row.inspection_date, row.updatedAt, row.createdAt]) || null,
          category_name,
          instrument: tm.instrument || "",
          location: tm.location || "",
        };
      });

      return res.json({
        success: true,
        inspection_id: inspectionId,
        purchase_order_item_id: poItemId,
        batch_id: batchId,
        po_stage_id: poStage?.id || null,
        stage_id: stageId,
        stage_status,
        selected_quantity: selectedQty,
        total_tests: tests.length,
        tests_master: ensureUniqueById(testsMasterRows).map((tm) => ({
          id: Number(tm.id),
          test_name: tm.test_name || tm.name || `Test ${tm.id}`,
          description: tm.description || "",
          category_name,
          instrument: tm.instrument || "",
          location: tm.location || "",
        })),
        tests,
        history_tests,
      });

    } catch (e) {
      console.error("getPoTestsStatus:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // âœ… safety: duplicate tests avoid

  static async getProgressOverview(req, res) {
    try {
      const inspectionId = Number(req.params.inspection_id);
      const batchId = Number(req.query.batch_id);
      const poItemId = Number(req.query.item_id);

      if (![inspectionId, batchId, poItemId].every(Number.isFinite)) {
        return res.status(400).json({ success: false, message: "inspection_id, batch_id, item_id required" });
      }

      // 1) inspection + PO + vendor
      const inspection = await Inspection.findByPk(inspectionId, {
        include: [{
          model: PurchaseOrder,
          attributes: ["po_number"],
          include: [{ model: Vendor, attributes: ["vendor_name"] }]
        }]
      });
      if (!inspection) return res.status(404).json({ success: false, message: "Inspection not found" });

      // 2) batch validate (must match same inspection + item)
      const batch = await InspectionBatch.findByPk(batchId);
      if (!batch) return res.status(400).json({ success: false, message: "Batch not found" });

      if (Number(batch.inspection_id) !== inspectionId || Number(batch.purchase_order_item_id) !== poItemId) {
        return res.status(400).json({ success: false, message: "Invalid batch (inspection/item mismatch)" });
      }

      const batchQty = Number(batch.selected_quantity || 0);

      // 3) master stages
      const stagesMaster = await Stage.findAll({ order: [["id", "ASC"]], raw: true });

      // 4) started stages for this item+batch
      const poStages = await PoStage.findAll({
        where: { inspection_id: inspectionId, batch_id: batchId, item_id: poItemId },
        raw: true
      });

      // 5) stage tests for this item+batch
      const stageTests = await StageTest.findAll({
        where: { inspection_id: inspectionId, batch_id: batchId, item_id: poItemId },
        raw: true
      });

      const normalize = (s) => {
        if (!s) return "pending";
        const v = String(s).trim().toLowerCase().replace(/\s+/g, "_");
        if (v === "inprogress" || v === "in_progress") return "in_progress";
        if (v === "completed") return "completed";
        if (v === "rework" || v === "failed") return "rework";
        return v;
      };

      const poStageByStageId = {};
      for (const ps of poStages) poStageByStageId[Number(ps.stage_id)] = ps;

      const testsByPoStageId = {};
      for (const t of stageTests) {
        const pid = Number(t.po_stage_id);
        if (!testsByPoStageId[pid]) testsByPoStageId[pid] = [];
        testsByPoStageId[pid].push(t);
      }

      const docsLen = (docs) => {
        if (!docs) return 0;
        if (Array.isArray(docs)) return docs.length;
        if (typeof docs === "string") {
          try {
            const parsed = JSON.parse(docs);
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch { return 0; }
        }
        return 0;
      };

      // Per-stage compute (same logic as workspace)
      const perStage = stagesMaster.map((st) => {
        const stageId = Number(st.id);
        const ps = poStageByStageId[stageId] || null;
        const poStageId = ps ? Number(ps.id) : null;

        const rows = poStageId ? (testsByPoStageId[poStageId] || []) : [];

        // latest record per test_id
        const latestByTest = {};
        for (const r of rows) latestByTest[Number(r.test_id)] = r;

        let completedTests = 0;
        let failReports = 0;
        let docsCount = 0;

        for (const tid of Object.keys(latestByTest)) {
          const lr = latestByTest[tid];
          const result = String(lr.result || "").toLowerCase();
          if (result === "pass" || result === "fail" || result === "rework" || result === "reject") completedTests++;
          if (result === "fail" || result === "rework" || result === "reject") failReports++;
        }

        for (const r of rows) docsCount += docsLen(r.documents);

        const totalTests =
          Number(st.total_tests || 0) > 0 ? Number(st.total_tests) : Object.keys(latestByTest).length;

        const status = normalize(ps?.status);

        return { stageId, status, totalTests, completedTests, failReports, docsCount, updatedAt: ps?.updatedAt || ps?.updated_at || null };
      });

      // totals for Progress Overview
      const totalStages = stagesMaster.length;
      const completedStages = perStage.filter(s => s.status === "completed").length;

      const totalTests = perStage.reduce((s, x) => s + Number(x.totalTests || 0), 0);
      const completedTests = perStage.reduce((s, x) => s + Number(x.completedTests || 0), 0);

      const reportsUploaded = perStage.reduce((s, x) => s + Number(x.failReports || 0), 0);
      const docsUploaded = perStage.reduce((s, x) => s + Number(x.docsCount || 0), 0);

      return res.json({
        success: true,
        data: {
          po_number: inspection?.PurchaseOrder?.po_number || null,
          vendor_name: inspection?.PurchaseOrder?.Vendor?.vendor_name || null,
          inspection_id: inspectionId,
          item_id: poItemId,
          batch_id: batchId,
          batch_quantity: batchQty,
          batch_status: batch.status,

          progress: {
            stages_completed: completedStages,
            total_stages: totalStages,

            tests_completed: completedTests,
            total_tests: totalTests,

            reports_uploaded: reportsUploaded,
            docs_uploaded: docsUploaded
          }
        }
      });

    } catch (e) {
      console.error("getProgressOverview:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
  static async PostPoTestsStatus(req, res) {
    const sequelize = Inspection.sequelize;
    let trx;

    const ynToBool = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim().toLowerCase();
      if (["yes", "y", "true", "1", "completed"].includes(s)) return true;
      if (["no", "n", "false", "0", "not_completed", "in_progress"].includes(s)) return false;
      return null;
    };

    const normalizeResult = (v) => {
      const s = String(v || "").trim().toLowerCase();
      if (s === "pass" || s === "passed") return "pass";
      if (s === "fail" || s === "failed") return "fail";
      if (s === "reject" || s === "rejected") return "reject";
      return s;
    };

    const normalizeSubmittedInspectionDate = (value) => {
      if (value === null || value === undefined) return new Date();
      const trimmed = String(value).trim();
      if (!trimmed) return new Date();

      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        return new Date();
      }
      return parsed;
    };

    try {
      trx = await sequelize.transaction();

      const {
        inspection_id,
        item_id,
        test_id,
        stage_id,
        batch_id,
        quantity,
        description,
        remarks,
        gps_location,
        inspection_date,
        result,
      } = req.body;

      // âœ… files from multer (field = documents)
      const files = req.files || [];
      const docsArray = files.map((file) => ({
        name: file.originalname,
        mime: file.mimetype,
        url: `/api/uploads/report/${file.filename}`,
      }));

      // Android se aata: stage_completed / inspection_completed
      const stageRaw = req.body.stage_status ?? req.body.stage_completed;
      const inspectionRaw = req.body.inspection_status ?? req.body.inspection_completed;

      /* ================= VALIDATION ================= */
      if (!inspection_id || !item_id || !test_id || !stage_id || !batch_id) {
        await trx.rollback();
        return res.status(400).json({
          status: "error",
          message: "inspection_id, item_id, test_id, stage_id, batch_id required",
        });
      }

      const inspectionId = Number(inspection_id);
      const poItemId = Number(item_id);
      const testId = Number(test_id);
      const stageId = Number(stage_id);
      const batchId = Number(batch_id);
      const qty = Number(quantity);

      if (![inspectionId, poItemId, testId, stageId, batchId, qty].every(Number.isFinite) || qty <= 0) {
        await trx.rollback();
        return res.status(400).json({ status: "error", message: "Invalid numeric values" });
      }

      const normalizedResult = normalizeResult(result);
      if (!["pass", "fail", "reject"].includes(normalizedResult)) {
        await trx.rollback();
        return res.status(400).json({ status: "error", message: "result must be pass, fail or reject" });
      }

      // âœ… test must exist
      const testExists = await Test.findByPk(testId, { transaction: trx });
      if (!testExists) {
        await trx.rollback();
        return res.status(400).json({
          status: "error",
          message: `Invalid test_id ${testId}. This id does not exist in tests table.`,
        });
      }

      /* ================= BATCH VALIDATION ================= */
      const batch = await InspectionBatch.findByPk(batchId, { transaction: trx });
      if (!batch || Number(batch.inspection_id) !== inspectionId || Number(batch.purchase_order_item_id) !== poItemId) {
        await trx.rollback();
        return res.status(400).json({ status: "error", message: "Invalid batch" });
      }
      if (batch.status !== "active") {
        await trx.rollback();
        return res.status(400).json({ status: "error", message: "Batch not active" });
      }

      const inspectionRow = await Inspection.findByPk(inspectionId, { transaction: trx });
      if (!inspectionRow) {
        await trx.rollback();
        return res.status(404).json({ status: "error", message: "Inspection not found" });
      }

      const assignmentId = Number(inspectionRow?.assignment_id || 0);
      const submittedInspectionDate = normalizeSubmittedInspectionDate(inspection_date);

      const selectedQty = Number(batch.selected_quantity || 0);

      /* ================= STATUS LOGIC (AS PER YOUR RULE) ================= */
      const stageCompletedBool = ynToBool(stageRaw);
      const inspectionCompletedBool = ynToBool(inspectionRaw);

      let stage_status = "in_progress";
      let inspection_status = "in_progress";
      let finalInspectionStatus = "in_progress";
      let finalBatchStatus = "active";

      if (normalizedResult === "reject") {
        stage_status = "rework";
        inspection_status = "rejected";
      }

      // âœ… FAIL => stage always REWORK, batch never completed
      else if (normalizedResult === "fail") {
        stage_status = "rework";
        inspection_status = "in_progress";
      } else {
        // âœ… PASS
        stage_status = stageCompletedBool ? "completed" : "in_progress";
        inspection_status = inspectionCompletedBool ? "completed" : "in_progress";
      }

      /* ================= FIND / CREATE PO STAGE ================= */
      let poStage = await PoStage.findOne({
        where: {
          inspection_id: inspectionId,
          stage_id: stageId,
          batch_id: batchId,
          item_id: poItemId,
        },
        transaction: trx,
      });

      const poStagePayload = {
        inspection_id: inspectionId,
        stage_id: stageId,
        batch_id: batchId,
        item_id: poItemId,
        inspector_id: req.user?.id ?? null,
        status: stage_status,
        result: stage_status === "completed" ? "pass" : (stage_status === "rework" ? "fail" : null),
      };

      if (!poStage) {
        poStage = await PoStage.create(poStagePayload, { transaction: trx });
      } else {
        await poStage.update(
          { status: poStagePayload.status, result: poStagePayload.result },
          { transaction: trx }
        );
      }

      /* ================= QUANTITY CHECK ================= */
      const alreadyTested = await StageTest.findAll({
        where: {
          inspection_id: inspectionId,
          po_stage_id: poStage.id,
          item_id: poItemId,
          batch_id: batchId,
          test_id: testId,
          status: { [Op.not]: "rework" },
        },
        transaction: trx,
        raw: true,
      });

      const prevQty = alreadyTested.reduce((s, r) => s + Number(r.quantity || 0), 0);
      const remainingQty = Math.max(selectedQty - prevQty, 0);

      if (qty > remainingQty) {
        await trx.rollback();
        return res.status(400).json({
          status: "error",
          message: `Max allowed for this test is ${remainingQty}`,
        });
      }

      /* ================= SAVE STAGETEST ================= */
      const stageTest = await StageTest.create(
        {
          po_stage_id: poStage.id,
          stage_id: stageId,
          batch_id: batchId,
          inspection_id: inspectionId,
          item_id: poItemId,
          test_id: testId,
          quantity: qty,
          description: description ?? "",
          remark: remarks ?? "",
          gps_location: gps_location ?? null,
          inspection_date: submittedInspectionDate,
          result: normalizedResult,
          status: normalizedResult === "pass" ? "completed" : "rework",
          documents: docsArray, // âœ… urls saved
          inspector_id: req.user?.id ?? null,
        },
        { transaction: trx }
      );

      /* ================= REJECT RESPONSE ================= */
      if (normalizedResult === "reject") {
        const rejectionNote = [description, remarks]
          .map((v) => String(v || "").trim())
          .filter(Boolean)
          .join(" | ");

        await Inspection.update(
          {
            status: "rejected",
            remarks: rejectionNote || "Item rejected",
          },
          {
            where: { id: inspectionId },
            transaction: trx,
          }
        );

        if (assignmentId > 0) {
          await InspectionAssignmentItem.update(
            {
              status: "cancelled",
              ended_at: new Date(),
              ended_by: req.user?.id ?? null,
            },
            {
              where: {
                assignment_id: assignmentId,
                purchase_order_item_id: poItemId,
                ended_at: null,
                status: { [Op.notIn]: ["completed", "cancelled"] },
              },
              transaction: trx,
            }
          );

          await InspectionBatch.update(
            { status: "cancelled", result: "fail" },
            {
              where: {
                inspection_id: inspectionId,
                purchase_order_item_id: poItemId,
                status: { [Op.ne]: "completed" },
              },
              transaction: trx,
            }
          );
        }

        await InspectionEvent.create(
          {
            assignment_id: assignmentId || null,
            inspection_id: inspectionId,
            case_id: inspectionRow?.case_id ?? null,
            actor_user_id: req.user?.id ?? null,
            type: "reject_item",
            note: rejectionNote || "Item rejected during test submission",
            before: { status: inspectionRow?.status || null },
            after: { status: "rejected", purchase_order_item_id: poItemId },
          },
          { transaction: trx }
        );

        await trx.commit();

        return res.json({
          status: "success",
          message: "Item rejected successfully",
          data: {
            stage_test_id: stageTest.id,
            stage_status: "rework",
            batch_status: "cancelled",
            inspection_status: "rejected",
          },
        });
      }

      /* ================= FAIL RESPONSE ================= */
      if (normalizedResult === "fail") {
        // âœ… Any failed test moves full stage into rework cycle.
        // Earlier passed tests become rework so they re-appear in dropdown for re-inspection.
        await StageTest.update(
          { status: "rework" },
          {
            where: {
              inspection_id: inspectionId,
              po_stage_id: poStage.id,
              item_id: poItemId,
              batch_id: batchId,
              test_id: { [Op.ne]: testId },
              result: "pass",
              status: { [Op.ne]: "rework" },
            },
            transaction: trx,
          }
        );

        await poStage.update({ status: "rework", result: "fail" }, { transaction: trx });
        await batch.update({ status: "active", result: null }, { transaction: trx });
        await Inspection.update(
          {
            status: "in_progress",
          },
          {
            where: { id: inspectionId },
            transaction: trx,
          }
        );

        if (assignmentId > 0) {
          await InspectionAssignmentItem.update(
            {
              status: "active",
              ended_at: null,
              ended_by: null,
            },
            {
              where: {
                assignment_id: assignmentId,
                purchase_order_item_id: poItemId,
                status: { [Op.in]: ["active", "completed"] },
              },
              transaction: trx,
            }
          );
        }

        await trx.commit();
        return res.json({
          status: "success",
          message: "Test failed. Stage moved to REWORK.",
          data: {
            stage_test_id: stageTest.id,
            stage_status: "rework",
            batch_status: "active",
            inspection_status: "in_progress",
          },
        });
      }

      /* ================= BATCH COMPLETION (inspection_completed) ================= */
      if (inspection_status === "completed" && normalizedResult === "pass") {
        await batch.update({ status: "completed", result: "pass" }, { transaction: trx });
        finalBatchStatus = "completed";

        const completedBatches = await InspectionBatch.findAll({
          where: {
            inspection_id: inspectionId,
            purchase_order_item_id: poItemId,
            status: "completed",
          },
          attributes: ["selected_quantity"],
          transaction: trx,
          raw: true,
        });

        const completedBatchQuantity = completedBatches.reduce(
          (sum, row) => sum + Number(row.selected_quantity || 0),
          0
        );

        const poItem = await PurchaseOrderItem.findByPk(poItemId, {
          attributes: ["id", "quantity"],
          transaction: trx,
          raw: true,
        });

        if (!poItem) {
          await trx.rollback();
          return res.status(404).json({
            status: "error",
            message: "Purchase order item not found",
          });
        }

        const totalItemQuantity = Number(poItem.quantity || 0);
        const itemCompletionReached =
          totalItemQuantity > 0 && completedBatchQuantity >= totalItemQuantity;

        finalInspectionStatus = itemCompletionReached ? "completed" : "in_progress";

        if (assignmentId > 0) {
          if (itemCompletionReached) {
            await InspectionAssignmentItem.update(
              {
                status: "completed",
                ended_at: new Date(),
                ended_by: req.user?.id ?? null,
              },
              {
                where: {
                  assignment_id: assignmentId,
                  purchase_order_item_id: poItemId,
                  ended_at: null,
                  status: { [Op.notIn]: ["completed", "cancelled"] },
                },
                transaction: trx,
              }
            );
          } else {
            await InspectionAssignmentItem.update(
              {
                status: "active",
                ended_at: null,
                ended_by: null,
              },
              {
                where: {
                  assignment_id: assignmentId,
                  purchase_order_item_id: poItemId,
                  status: { [Op.in]: ["active", "completed"] },
                },
                transaction: trx,
              }
            );
          }
        }
      } else if (normalizedResult === "pass") {
        finalInspectionStatus = "in_progress";

        if (assignmentId > 0) {
          await InspectionAssignmentItem.update(
            {
              status: "active",
              ended_at: null,
              ended_by: null,
            },
            {
              where: {
                assignment_id: assignmentId,
                purchase_order_item_id: poItemId,
                status: { [Op.in]: ["active", "completed"] },
              },
              transaction: trx,
            }
          );
        }
      }

      await Inspection.update(
        {
          status: finalInspectionStatus,
        },
        {
          where: { id: inspectionId },
          transaction: trx,
        }
      );

      await trx.commit();

      return res.json({
        status: "success",
        message: "Test saved successfully",
        data: {
          stage_test_id: stageTest.id,
          batch_status: finalBatchStatus,
          stage_status: poStage.status,
          inspection_status: finalInspectionStatus,
        },
      });

    } catch (err) {
      if (trx) await trx.rollback();
      console.error("PostPoTestsStatus ERROR:", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  static async cancelOrRescheduleAssignment(req, res) {
    const sequelize = InspectionAssignment.sequelize;
    let trx;

    try {
      const {
        assignment_id,
        reason,
        schedule_datetime
      } = req.body;

      if (!assignment_id || !reason || reason.trim() === "") {
        inspectionDebug("cancelOrRescheduleAssignment.validation_failed", {
          reason: "assignment_id and reason required",
          assignment_id: assignment_id || null,
        });
        return res.status(400).json({
          success: false,
          message: "assignment_id and reason required"
        });
      }

      trx = await sequelize.transaction();

      const asg = await InspectionAssignment.findByPk(Number(assignment_id), {
        transaction: trx
      });

      if (!asg) {
        await trx.rollback();
        inspectionDebug("cancelOrRescheduleAssignment.not_found", {
          assignment_id: Number(assignment_id),
        });
        return res.status(404).json({
          success: false,
          message: "Assignment not found"
        });
      }

      const isReschedule = !!schedule_datetime;
      const nextScheduleDate = isReschedule ? toValidDate(schedule_datetime) : null;
      if (isReschedule && !nextScheduleDate) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Valid schedule_datetime is required"
        });
      }

      const before = {
        status: asg.status,
        scheduled_on: asg.scheduled_on
      };

      let updatePayload = {};

      if (isReschedule) {
        updatePayload.status = "rescheduled";
        updatePayload.scheduled_on = nextScheduleDate;
      } else {
        updatePayload.status = "cancelled";
        updatePayload.ended_at = new Date();
        updatePayload.ended_by = req.user?.id ?? null;
      }

      inspectionDebug("cancelOrRescheduleAssignment.update_payload", {
        assignment_id: asg.id,
        is_reschedule: isReschedule,
        before,
        update_payload: updatePayload,
      });

      if (isReschedule) {
        await syncAssignmentAndInspectionSchedules({
          assignment: asg,
          nextScheduleDate,
          reason,
          transaction: trx,
        });
      } else {
        await asg.update(updatePayload, { transaction: trx });
      }

      // âŒ Only when cancelling (not rescheduling)
      if (!isReschedule) {
        await InspectionAssignmentItem.update(
          {
            status: "cancelled",
            ended_at: new Date(),
            ended_by: req.user?.id ?? null
          },
          {
            where: {
              assignment_id: asg.id,
              status: "active"
            },
            transaction: trx
          }
        );
      }

      const after = {
        status: asg.status,
        scheduled_on: asg.scheduled_on
      };

      // âœ… HISTORY (no overwrite ever)
      await InspectionEvent.create({
        assignment_id: asg.id,
        case_id: asg.case_id,
        actor_user_id: req.user?.id ?? null,
        type: isReschedule ? "reschedule" : "cancel",
        note: reason,
        before,
        after
      }, { transaction: trx });

      await trx.commit();

      return res.json({
        success: true,
        message: isReschedule
          ? "Assignment rescheduled successfully"
          : "Assignment cancelled successfully"
      });

    } catch (e) {
      if (trx) await trx.rollback();
      console.error("cancelOrRescheduleAssignment:", e);
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
  static async cancelInspection(req, res) {
    const sequelize = Inspection.sequelize;
    let trx;

    try {
      const {
        inspection_id,
        assignment_id,
        purchase_order_item_id,
        reason,
        schedule_datetime,
      } = req.body;

      inspectionDebug("cancelInspection.request", {
        user_id: req.user?.id ?? null,
        body: req.body,
      });

      if (!reason || String(reason).trim() === "") {
        inspectionDebug("cancelInspection.validation_failed", {
          reason: "reason required",
        });
        return res.status(400).json({
          success: false,
          message: "reason required",
        });
      }

      const inspectionIdNum = Number(inspection_id || 0);
      const assignmentIdNum = Number(assignment_id || 0);
      const poItemIdNum = Number(purchase_order_item_id || 0);

      const hasInspectionId = Number.isFinite(inspectionIdNum) && inspectionIdNum > 0;
      const hasAssignmentId = Number.isFinite(assignmentIdNum) && assignmentIdNum > 0;
      const hasPoItemId = Number.isFinite(poItemIdNum) && poItemIdNum > 0;
      const isReschedule = !!schedule_datetime;
      const nextScheduleDate = isReschedule ? toValidDate(schedule_datetime) : null;

      if (isReschedule && !nextScheduleDate) {
        inspectionDebug("cancelInspection.validation_failed", {
          reason: "invalid schedule_datetime",
          schedule_datetime: schedule_datetime || null,
        });
        return res.status(400).json({
          success: false,
          message: "Valid schedule_datetime is required",
        });
      }

      const itemMode = hasInspectionId || (hasAssignmentId && hasPoItemId);
      if (!itemMode && !hasAssignmentId) {
        inspectionDebug("cancelInspection.validation_failed", {
          reason: "inspection_id or assignment_id required",
          inspection_id: inspection_id || null,
          assignment_id: assignment_id || null,
        });
        return res.status(400).json({
          success: false,
          message: "inspection_id or assignment_id required",
        });
      }

      trx = await sequelize.transaction();

      if (itemMode) {
        let insp = null;

        if (hasInspectionId) {
          insp = await Inspection.findByPk(inspectionIdNum, { transaction: trx });
        } else {
          insp = await Inspection.findOne({
            where: {
              assignment_id: assignmentIdNum,
              purchase_order_item_id: poItemIdNum,
            },
            order: [["id", "DESC"]],
            transaction: trx,
          });
        }

        if (!insp) {
          await trx.rollback();
          inspectionDebug("cancelInspection.not_found", {
            inspection_id: inspectionIdNum || null,
            assignment_id: assignmentIdNum || null,
            purchase_order_item_id: poItemIdNum || null,
          });
          return res.status(404).json({ success: false, message: "Inspection not found" });
        }

        if (
          !isAdminUser(req) &&
          req.user?.id &&
          Number(insp.inspector_id || 0) > 0 &&
          Number(insp.inspector_id) !== Number(req.user.id)
        ) {
          await trx.rollback();
          return res.status(403).json({ success: false, message: "Not allowed" });
        }

        if (hasPoItemId && Number(insp.purchase_order_item_id) !== poItemIdNum) {
          await trx.rollback();
          return res.status(400).json({ success: false, message: "Item mismatch" });
        }

        const before = {
          status: insp.status,
          schedule_datetime: insp.schedule_datetime ?? null,
        };

        const updatePayload = {
          status: isReschedule ? "rescheduled" : "cancelled",
          remarks: String(reason || insp.remarks || "").trim() || null,
        };
        if (isReschedule) {
          updatePayload.schedule_datetime = nextScheduleDate;
        }

        inspectionDebug("cancelInspection.update_payload", {
          mode: "item",
          inspection_id: insp.id,
          is_reschedule: isReschedule,
          update_payload: updatePayload,
        });

        if (isReschedule) {
          await syncInspectionAndAssignmentSchedule({
            inspection: insp,
            nextScheduleDate,
            reason: String(reason || "").trim(),
            transaction: trx,
          });
        } else {
          await insp.update(updatePayload, { transaction: trx });
        }

        let assignmentItemAffectedRows = 0;
        if (Number(insp.assignment_id || 0) > 0 && Number(insp.purchase_order_item_id || 0) > 0) {
          if (isReschedule) {
            const [affectedRows] = await InspectionAssignmentItem.update(
              { status: "active", ended_at: null, ended_by: null },
              {
                where: {
                  assignment_id: Number(insp.assignment_id),
                  purchase_order_item_id: Number(insp.purchase_order_item_id),
                  status: "cancelled",
                },
                transaction: trx,
              }
            );
            assignmentItemAffectedRows = Number(affectedRows || 0);
          } else {
            const [affectedRows] = await InspectionAssignmentItem.update(
              { status: "cancelled", ended_at: new Date(), ended_by: req.user?.id ?? null },
              {
                where: {
                  assignment_id: Number(insp.assignment_id),
                  purchase_order_item_id: Number(insp.purchase_order_item_id),
                  status: "active",
                },
                transaction: trx,
              }
            );
            assignmentItemAffectedRows = Number(affectedRows || 0);
          }
        }

        if (!isReschedule) {
          await InspectionBatch.update(
            { status: "cancelled", result: "fail" },
            {
              where: {
                inspection_id: Number(insp.id),
                purchase_order_item_id: Number(insp.purchase_order_item_id),
                status: { [Op.ne]: "completed" },
              },
              transaction: trx,
            }
          );
        }

        const after = {
          status: insp.status,
          schedule_datetime: insp.schedule_datetime ?? null,
          purchase_order_item_id: Number(insp.purchase_order_item_id || 0) || null,
        };

        await InspectionEvent.create(
          {
            assignment_id: Number(insp.assignment_id || 0) || null,
            inspection_id: insp.id,
            case_id: Number(insp.case_id || 0) || null,
            actor_user_id: req.user?.id ?? null,
            type: isReschedule ? "reschedule_item" : "cancel_item",
            note: String(reason || "").trim(),
            before,
            after,
          },
          { transaction: trx }
        );

        await trx.commit();
        inspectionDebug("cancelInspection.success", {
          mode: "item",
          inspection_id: insp.id,
          operation: isReschedule ? "reschedule" : "cancel",
          assignment_item_affected_rows: assignmentItemAffectedRows,
          after,
        });

        return res.json({
          success: true,
          message: isReschedule
            ? "Item rescheduled successfully"
            : "Item cancelled successfully",
        });
      }

      const asg = await InspectionAssignment.findByPk(assignmentIdNum, {
        transaction: trx
      });

      if (!asg) {
        await trx.rollback();
        inspectionDebug("cancelInspection.not_found", {
          assignment_id: assignmentIdNum,
        });
        return res.status(404).json({
          success: false,
          message: "Assignment not found"
        });
      }

      const before = {
        status: asg.status,
        scheduled_on: asg.scheduled_on
      };

      const updatePayload = {};
      if (isReschedule) {
        updatePayload.status = "rescheduled";
        updatePayload.scheduled_on = nextScheduleDate;
      } else {
        updatePayload.status = "cancelled";
        updatePayload.ended_at = new Date();
        updatePayload.ended_by = req.user?.id ?? null;
      }

      inspectionDebug("cancelInspection.update_payload", {
        mode: "assignment",
        assignment_id: asg.id,
        is_reschedule: isReschedule,
        before,
        update_payload: updatePayload,
      });

      if (isReschedule) {
        await syncAssignmentAndInspectionSchedules({
          assignment: asg,
          nextScheduleDate,
          reason: String(reason || "").trim(),
          transaction: trx,
        });
      } else {
        await asg.update(updatePayload, { transaction: trx });
      }

      if (isReschedule) {
        await InspectionAssignmentItem.update(
          {
            status: "active",
            ended_at: null,
            ended_by: null,
          },
          {
            where: {
              assignment_id: asg.id,
              status: "cancelled",
            },
            transaction: trx,
          }
        );
      }

      let cancelledItemsCount = 0;
      if (!isReschedule) {
        const [affectedRows] = await InspectionAssignmentItem.update(
          {
            status: "cancelled",
            ended_at: new Date(),
            ended_by: req.user?.id ?? null
          },
          {
            where: {
              assignment_id: asg.id,
              status: "active"
            },
            transaction: trx
          }
        );
        cancelledItemsCount = Number(affectedRows || 0);
      }

      const after = {
        status: asg.status,
        scheduled_on: asg.scheduled_on
      };

      await InspectionEvent.create({
        assignment_id: asg.id,
        case_id: asg.case_id,
        actor_user_id: req.user?.id ?? null,
        type: isReschedule ? "reschedule" : "cancel",
        note: String(reason || "").trim(),
        before,
        after
      }, { transaction: trx });

      await trx.commit();
      inspectionDebug("cancelInspection.success", {
        mode: "assignment",
        assignment_id: asg.id,
        operation: isReschedule ? "reschedule" : "cancel",
        cancelled_items_count: cancelledItemsCount,
        after,
      });

      return res.json({
        success: true,
        message: isReschedule
          ? "Assignment rescheduled successfully"
          : "Assignment cancelled successfully"
      });

    } catch (e) {
      if (trx) await trx.rollback();
      inspectionDebug("cancelInspection.error", {
        message: e?.message || String(e),
      });
      console.error("cancelInspection:", e);
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
  static async cancelInspectionItem(req, res) {
    const sequelize = InspectionAssignment.sequelize;
    let trx;

    try {
      const { inspection_id, purchase_order_item_id, reason } = req.body;
      if (!inspection_id || !purchase_order_item_id || !reason || reason.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "inspection_id, purchase_order_item_id and reason required"
        });
      }

      trx = await sequelize.transaction();

      const insp = await Inspection.findByPk(Number(inspection_id), { transaction: trx });
      if (!insp) {
        await trx.rollback();
        return res.status(404).json({ success: false, message: "Inspection not found" });
      }

      if (!isAdminUser(req) && Number(insp.inspector_id) !== Number(req.user.id)) {
        await trx.rollback();
        return res.status(403).json({ success: false, message: "Not allowed" });
      }

      if (Number(insp.purchase_order_item_id) !== Number(purchase_order_item_id)) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: "Item mismatch" });
      }

      if (String(insp.status || "").trim().toLowerCase() === "rejected") {
        await trx.commit();
        return res.json({ success: true, message: "Item already rejected" });
      }

      const before = { status: insp.status };

      await insp.update(
        {
          status: "cancelled",
          remarks: reason
        },
        { transaction: trx }
      );

      await InspectionAssignmentItem.update(
        {
          status: "cancelled",
          ended_at: new Date(),
          ended_by: req.user?.id ?? null
        },
        {
          where: {
            assignment_id: insp.assignment_id,
            purchase_order_item_id: Number(purchase_order_item_id),
            status: "active"
          },
          transaction: trx
        }
      );

      await InspectionBatch.update(
        { status: "cancelled", result: "fail" },
        {
          where: {
            inspection_id: Number(insp.id),
            purchase_order_item_id: Number(purchase_order_item_id),
            status: { [Op.ne]: "completed" },
          },
          transaction: trx,
        }
      );

      await InspectionEvent.create(
        {
          inspection_id: insp.id,
          assignment_id: insp.assignment_id,
          case_id: insp.case_id,
          actor_user_id: req.user?.id ?? null,
          type: "cancel_item",
          note: reason,
          before,
          after: { status: "cancelled", purchase_order_item_id: Number(purchase_order_item_id) }
        },
        { transaction: trx }
      );

      await trx.commit();

      return res.json({ success: true, message: "Item cancelled successfully" });
    } catch (e) {
      if (trx) await trx.rollback();
      console.error("cancelInspectionItem:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async rescheduleInspectionItem(req, res) {
    const sequelize = Inspection.sequelize;
    let trx;

    try {
      const { inspection_id, purchase_order_item_id, schedule_datetime, reason } = req.body;
      inspectionDebug("rescheduleInspectionItem.request", {
        user_id: req.user?.id ?? null,
        body: req.body,
      });
      if (!inspection_id || !schedule_datetime) {
        inspectionDebug("rescheduleInspectionItem.validation_failed", {
          reason: "inspection_id and schedule_datetime required",
          inspection_id: inspection_id || null,
          schedule_datetime: schedule_datetime || null,
        });
        return res.status(400).json({
          success: false,
          message: "inspection_id and schedule_datetime required",
        });
      }

      trx = await sequelize.transaction();

      const insp = await Inspection.findByPk(Number(inspection_id), { transaction: trx });
      if (!insp) {
        await trx.rollback();
        inspectionDebug("rescheduleInspectionItem.not_found", {
          inspection_id: Number(inspection_id),
        });
        return res.status(404).json({ success: false, message: "Inspection not found" });
      }

      if (!isAdminUser(req) && Number(insp.inspector_id) !== Number(req.user.id)) {
        await trx.rollback();
        return res.status(403).json({ success: false, message: "Not allowed" });
      }

      if (purchase_order_item_id && Number(insp.purchase_order_item_id) !== Number(purchase_order_item_id)) {
        await trx.rollback();
        inspectionDebug("rescheduleInspectionItem.item_mismatch", {
          inspection_id: Number(inspection_id),
          purchase_order_item_id: Number(purchase_order_item_id),
          actual_item_id: Number(insp.purchase_order_item_id || 0) || null,
        });
        return res.status(400).json({ success: false, message: "Item mismatch" });
      }

      const before = {
        status: insp.status,
        schedule_datetime: insp.schedule_datetime,
      };

      inspectionDebug("rescheduleInspectionItem.update_payload", {
        inspection_id: insp.id,
        before,
        next_schedule_datetime: schedule_datetime,
        next_reason: reason || insp.remarks || null,
      });

      const nextScheduleDate = toValidDate(schedule_datetime);
      if (!nextScheduleDate) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Valid schedule_datetime is required",
        });
      }

      await syncInspectionAndAssignmentSchedule({
        inspection: insp,
        nextScheduleDate,
        reason,
        transaction: trx,
      });

      if (Number(insp.assignment_id || 0) > 0 && Number(insp.purchase_order_item_id || 0) > 0) {
        await InspectionAssignmentItem.update(
          { status: "active", ended_at: null, ended_by: null },
          {
            where: {
              assignment_id: Number(insp.assignment_id),
              purchase_order_item_id: Number(insp.purchase_order_item_id),
              status: "cancelled",
            },
            transaction: trx,
          }
        );
      }

      await InspectionEvent.create(
        {
          inspection_id: insp.id,
          assignment_id: insp.assignment_id,
          case_id: insp.case_id,
          actor_user_id: req.user?.id ?? null,
          type: "reschedule_item",
          note: reason || "Item rescheduled",
          before,
          after: {
            status: "rescheduled",
            schedule_datetime: insp.schedule_datetime,
            purchase_order_item_id: insp.purchase_order_item_id,
          },
        },
        { transaction: trx }
      );

      await trx.commit();
      inspectionDebug("rescheduleInspectionItem.success", {
        inspection_id: insp.id,
        schedule_datetime: insp.schedule_datetime,
      });
      return res.json({ success: true, message: "Item rescheduled successfully" });
    } catch (e) {
      if (trx) await trx.rollback();
      inspectionDebug("rescheduleInspectionItem.error", {
        message: e?.message || String(e),
      });
      console.error("rescheduleInspectionItem:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async getCancelledInspections(req, res) {
    try {
      const requestedInspectorId = Number(req.query.inspector_id || 0);
      const isAdmin = isAdminUser(req);
      const inspector_id =
        Number.isFinite(requestedInspectorId) && requestedInspectorId > 0
          ? requestedInspectorId
          : Number(req.user?.id || 0);

      if (!isAdmin && (!Number.isFinite(inspector_id) || inspector_id <= 0)) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const inspectorScope =
        isAdmin && !(Number.isFinite(requestedInspectorId) && requestedInspectorId > 0)
          ? {}
          : { inspector_id };

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const cancelledOrRejected = await Inspection.findAll({
        where: {
          ...inspectorScope,
          status: { [Op.in]: ["cancelled", "rejected"] },
        },
        include: [
          {
            model: PurchaseOrder,
            as: "PO",
            required: false,
            attributes: ["id", "po_number"],
            include: [{ model: Vendor, attributes: ["vendor_name"] }],
          },
          {
            model: PurchaseOrderItem,
            as: "PoItem",
            required: false,
            attributes: ["id", "item_id"],
            include: [{ model: Items, attributes: ["item_name"], required: false }],
          },
          {
            model: User,
            as: "Inspector",
            required: false,
            attributes: ["id", "name", "email"],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });

      const cancelledInspectionIds = cancelledOrRejected
        .map((row) => Number(row.id))
        .filter(Boolean);

      const cancelEvents = cancelledInspectionIds.length
        ? await InspectionEvent.findAll({
            where: {
              inspection_id: { [Op.in]: cancelledInspectionIds },
              type: { [Op.in]: ["cancel_item", "reject_item", "cancel"] },
            },
            attributes: ["inspection_id", "type", "note", "createdAt"],
            order: [["createdAt", "DESC"]],
            raw: true,
          })
        : [];

      const latestEventByInspection = new Map();
      for (const row of cancelEvents) {
        const key = Number(row.inspection_id || 0);
        if (!key || latestEventByInspection.has(key)) continue;
        latestEventByInspection.set(key, row);
      }

      const cancelledResult = cancelledOrRejected.map((insp) => {
        const po = insp.PO || null;
        const item = insp.PoItem || null;
        const event = latestEventByInspection.get(Number(insp.id)) || null;
        const inspectorName =
          insp.Inspector?.name ||
          insp.Inspector?.email ||
          (Number(insp.inspector_id || 0) > 0 ? `Inspector #${insp.inspector_id}` : "");
        const normalizedStatus = String(insp.status || "").toLowerCase();

        return {
          inspection_id: insp.id,
          assignment_id: Number(insp.assignment_id || 0) || null,
          po_id: po?.id || null,
          po_number: po?.po_number || "",
          vendor_name: po?.Vendor?.vendor_name || "",
          purchase_order_item_id: Number(insp.purchase_order_item_id || 0) || null,
          item_name: item?.Item?.item_name || item?.Items?.item_name || null,
          inspector_id: Number(insp.inspector_id || 0) || null,
          inspector_name: inspectorName,
          cancel_reason:
            event?.note ||
            (normalizedStatus === "rejected" ? "Item rejected" : "Item cancelled"),
          cancelled_at: event?.createdAt || insp.updatedAt || null,
          scheduled_on: insp.schedule_datetime || null,
          status: normalizedStatus || "cancelled",
          type: normalizedStatus === "rejected" ? "rejected" : "cancelled",
        };
      });

      const missedCandidates = await Inspection.findAll({
        where: {
          ...inspectorScope,
          status: { [Op.in]: ["assigned", "in_progress", "in_process", "rescheduled", "rework", "failed"] },
          schedule_datetime: { [Op.lt]: startOfToday },
        },
        include: [
          {
            model: PurchaseOrder,
            as: "PO",
            required: false,
            attributes: ["id", "po_number"],
            include: [{ model: Vendor, attributes: ["vendor_name"] }],
          },
          {
            model: PurchaseOrderItem,
            as: "PoItem",
            required: false,
            attributes: ["id", "item_id"],
            include: [{ model: Items, attributes: ["item_name"], required: false }],
          },
          {
            model: User,
            as: "Inspector",
            required: false,
            attributes: ["id", "name", "email"],
          },
        ],
        order: [["schedule_datetime", "DESC"]],
      });

      const missedResult = missedCandidates.map((insp) => {
        const po = insp.PO || null;
        const item = insp.PoItem || null;
        const inspectorName =
          insp.Inspector?.name ||
          insp.Inspector?.email ||
          (Number(insp.inspector_id || 0) > 0 ? `Inspector #${insp.inspector_id}` : "");

        return {
          inspection_id: insp.id,
          assignment_id: Number(insp.assignment_id || 0) || null,
          po_id: po?.id || null,
          po_number: po?.po_number || "",
          vendor_name: po?.Vendor?.vendor_name || "",
          purchase_order_item_id: Number(insp.purchase_order_item_id || 0) || null,
          item_name: item?.Item?.item_name || item?.Items?.item_name || null,
          inspector_id: Number(insp.inspector_id || 0) || null,
          inspector_name: inspectorName,
          cancel_reason: `Missed inspection date: ${formatMissedDate(insp.schedule_datetime)}`,
          cancelled_at: null,
          scheduled_on: insp.schedule_datetime,
          status: "missed",
          type: "missed",
        };
      });

      const result = [...cancelledResult, ...missedResult].sort(
        (a, b) => new Date(b.scheduled_on || 0) - new Date(a.scheduled_on || 0)
      );

      return res.json({
        success: true,
        count: result.length,
        data: result,
      });
    } catch (e) {
      console.error("getCancelledInspections:", e);
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
  static async reschedulePageInspection(req, res) {
    const sequelize = InspectionAssignment.sequelize;
    let trx;

    try {
      const { assignment_id, schedule_datetime, reason } = req.body;

      if (!assignment_id || !schedule_datetime) {
        return res.status(400).json({
          success: false,
          message: "assignment_id & schedule_datetime required"
        });
      }

      trx = await sequelize.transaction();

      const asg = await InspectionAssignment.findByPk(Number(assignment_id), {
        transaction: trx
      });

      if (!asg) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: "Assignment not found"
        });
      }

      // ðŸ”¹ BEFORE snapshot
      const before = {
        status: asg.status,
        scheduled_on: asg.scheduled_on
      };

      const nextScheduleDate = toValidDate(schedule_datetime);
      if (!nextScheduleDate) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: "Valid schedule_datetime is required"
        });
      }

      await syncAssignmentAndInspectionSchedules({
        assignment: asg,
        nextScheduleDate,
        reason,
        transaction: trx,
      });

      await InspectionAssignmentItem.update(
        {
          status: "active",
          ended_at: null,
          ended_by: null,
        },
        {
          where: {
            assignment_id: asg.id,
            status: "cancelled",
          },
          transaction: trx,
        }
      );

      // ðŸ”¹ AFTER snapshot
      const after = {
        status: asg.status,
        scheduled_on: asg.scheduled_on
      };

      // âœ… EVENT LOG (history safe)
      await InspectionEvent.create({
        assignment_id: asg.id,
        case_id: asg.case_id,
        po_id: null,
        actor_user_id: req.user?.id ?? null,
        type: "reschedule",
        note: reason || "Assignment rescheduled",
        before,
        after
      }, { transaction: trx });

      await trx.commit();

      return res.json({
        success: true,
        message: "Assignment rescheduled successfully"
      });

    } catch (e) {
      if (trx) await trx.rollback();
      console.error("reschedulePageInspection:", e);
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }



}
export default inspectionsController;

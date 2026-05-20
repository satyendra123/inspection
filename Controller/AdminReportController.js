import { Sequelize } from "sequelize";
import * as XLSX from "xlsx";
import {
  Inspection,
  InspectionAssignment,
  InspectionAssignmentItem,
  PoStage,
  Stage,
  StageTest,
  Test,
  PurchaseOrder,
  PurchaseOrderItem,
  Items,
  User,
  Company,
  Project,
  Vendor,
} from "../Model/index.js";

const { Op } = Sequelize;
const DAY_MS = 24 * 60 * 60 * 1000;

const SUMMARY_EXPORT_HEADERS = [
  "Sl.no",
  "Company Name",
  "Project Name",
  "PO no",
  "Vendor",
  "Item name",
  "Inspection Status",
  "Report Result",
  "Current Stage Name",
  "Current Stage Inspector",
  "Inspection Date",
  "Completed On",
  "Total Stages",
  "Completed Stages",
  "Total Tests",
  "Documents",
  "Days Involved",
  "Remarks",
];

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

const assignmentItemStatusPriority = {
  active: 0,
  rescheduled: 1,
  assigned: 2,
  in_process: 3,
  completed: 4,
  reassigned: 5,
  cancelled: 6,
};

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
    .map((entry, index) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        const url = toPublicUrl(entry, baseUrl);
        if (!url) return null;
        return {
          name: `Document ${index + 1}`,
          url,
        };
      }
      if (typeof entry === "object") {
        const urlValue = entry.url ?? entry.path ?? entry.file ?? entry.location ?? null;
        const url = toPublicUrl(urlValue, baseUrl);
        if (!url) return null;
        return {
          name: normalizeText(entry.name || entry.originalname || entry.filename || `Document ${index + 1}`),
          mime: normalizeText(entry.mime || entry.mimetype || ""),
          url,
        };
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

const normalizeText = (value) => String(value ?? "").trim();
const normalizeCompare = (value) => normalizeText(value).toLowerCase();
const normalizePoAttachments = (value) => {
  if (!value) return { attachment: null, attachments: [] };

  if (Array.isArray(value)) {
    const attachments = value.map((entry) => normalizeText(entry)).filter(Boolean);
    return { attachment: attachments[0] || null, attachments };
  }

  const normalized = normalizeText(value);
  if (!normalized) return { attachment: null, attachments: [] };

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      const attachments = parsed.map((entry) => normalizeText(entry)).filter(Boolean);
      return { attachment: attachments[0] || null, attachments };
    }
  } catch {
    // legacy single-path string
  }

  return { attachment: normalized, attachments: [normalized] };
};
const normalizePoDesignCopies = (value) => {
  if (!value) return { design_copy: null, design_copies: [] };

  if (Array.isArray(value)) {
    const designCopies = value.map((entry) => normalizeText(entry)).filter(Boolean);
    return { design_copy: designCopies[0] || null, design_copies: designCopies };
  }

  const normalized = normalizeText(value);
  if (!normalized) return { design_copy: null, design_copies: [] };

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      const designCopies = parsed.map((entry) => normalizeText(entry)).filter(Boolean);
      return { design_copy: designCopies[0] || null, design_copies: designCopies };
    }
  } catch {
    // legacy single-path string
  }

  return { design_copy: normalized, design_copies: [normalized] };
};

const normalizeStatusFilter = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (normalized === "active") return "assigned";
  if (normalized === "inprocess" || normalized === "inprogress") return "in_progress";
  if (normalized === "reject") return "rejected";
  return normalized;
};

const normalizeReportStageStatus = (value) => {
  const normalized = normalizeStatusFilter(value);
  if (!normalized) return "pending";
  if (normalized === "failed" || normalized === "rejected") return "failed";
  if (normalized === "completed") return "completed";
  if (normalized === "rework") return "rework";
  if (normalized === "pending") return "pending";
  return normalized;
};

const normalizeStageResult = (value) => {
  const normalized = normalizeCompare(value);
  if (!normalized) return null;
  if (normalized === "pass") return "pass";
  if (normalized === "fail" || normalized === "failed" || normalized === "reject" || normalized === "rejected") {
    return "fail";
  }
  return null;
};

const toTitleCase = (value) =>
  normalizeText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const toYmd = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toValidDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toValidTimestamp = (value) => {
  const parsed = toValidDate(value);
  return parsed ? parsed.getTime() : 0;
};

const toDayStart = (ymd) => {
  if (!ymd) return null;
  const parsed = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDayEndExclusive = (ymd) => {
  const start = toDayStart(ymd);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
};

const pickFirstValidDate = (values) => {
  for (const value of values || []) {
    const parsed = toValidDate(value);
    if (parsed) return parsed;
  }
  return null;
};

const pickLastValidDate = (values) => {
  let resolved = null;
  for (const value of values || []) {
    const parsed = toValidDate(value);
    if (parsed) resolved = parsed;
  }
  return resolved;
};

const calculateDurationDays = (startValue, endValue) => {
  const start = toValidDate(startValue);
  const end = toValidDate(endValue);
  if (!start || !end) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.max(1, Math.floor(diffMs / DAY_MS) + 1);
};

const dedupeTextJoin = (values = []) => {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result.join(" | ");
};

const getAssignmentItemPriority = (status) => {
  const key = normalizeCompare(status);
  return Object.prototype.hasOwnProperty.call(assignmentItemStatusPriority, key)
    ? assignmentItemStatusPriority[key]
    : 99;
};

const pickPreferredAssignmentItem = (rows = []) => {
  let best = null;

  for (const row of rows) {
    if (!row) continue;
    const poItemId = Number(row.purchase_order_item_id || 0) || null;
    if (!poItemId) continue;

    if (!best) {
      best = row;
      continue;
    }

    const bestPriority = getAssignmentItemPriority(best.status);
    const nextPriority = getAssignmentItemPriority(row.status);
    if (nextPriority < bestPriority) {
      best = row;
      continue;
    }

    if (nextPriority === bestPriority) {
      const bestUpdatedAt = toValidTimestamp(best.updatedAt);
      const nextUpdatedAt = toValidTimestamp(row.updatedAt);
      if (nextUpdatedAt > bestUpdatedAt) {
        best = row;
      }
    }
  }

  return best;
};

const getPoItemName = (poItem) => poItem?.Item?.item_name || poItem?.Items?.item_name || null;

const resolveCompanyName = (po) => {
  const directCompany = Array.isArray(po?.Companies)
    ? po.Companies.find((company) => normalizeText(company?.company_name))
    : null;
  return normalizeText(directCompany?.company_name || po?.Project?.Company?.company_name);
};

const resolveProjectName = (po) => normalizeText(po?.Project?.project_name || po?.project_name);

const resolveInspectorName = (stage, inspection) =>
  normalizeText(
    stage?.StageInspector?.name ||
      stage?.StageInspector?.email ||
      inspection?.Inspector?.name ||
      inspection?.Inspector?.email,
  );

const mapStageTestExecution = (row) => {
  const rawResult = normalizeCompare(row?.result);
  const normalizedStatus = normalizeReportStageStatus(row?.status);
  const quantity = Math.max(Number(row?.quantity || 0), 0);

  let status = "in_progress";
  let result = normalizeStageResult(row?.result);
  let passQuantity = 0;
  let failQuantity = 0;

  if (rawResult === "fail" || rawResult === "reject" || normalizedStatus === "failed") {
    status = "failed";
    result = "fail";
    failQuantity = quantity;
  } else if (normalizedStatus === "rework" || rawResult === "rework") {
    status = "rework";
    result = rawResult === "pass" ? "pass" : "fail";
    passQuantity = rawResult === "pass" ? quantity : 0;
    failQuantity = quantity;
  } else if (rawResult === "pass" || normalizedStatus === "completed") {
    status = "completed";
    result = "pass";
    passQuantity = quantity;
  } else if (normalizedStatus === "pending") {
    status = "pending";
  }

  return {
    status,
    result,
    quantity,
    pass_quantity: passQuantity,
    fail_quantity: failQuantity,
  };
};

const parseReportFilters = (query = {}) => {
  const search = normalizeText(query.search);
  const projectName = normalizeText(query.project_name);
  const requestedItemIdRaw = normalizeText(query.purchase_order_item_id);
  const requestedStatuses = normalizeText(query.status)
    .split(",")
    .map(normalizeStatusFilter)
    .filter(Boolean);

  const requestedItemId = requestedItemIdRaw ? Number(requestedItemIdRaw) : null;
  if (requestedItemIdRaw && (!Number.isFinite(requestedItemId) || requestedItemId <= 0)) {
    throw new Error("Invalid purchase_order_item_id filter.");
  }

  const requestedFrom = normalizeText(query.date_from);
  const requestedTo = normalizeText(query.date_to);

  let dateFrom = requestedFrom ? toYmd(requestedFrom) : null;
  let dateTo = requestedTo ? toYmd(requestedTo) : null;

  if ((requestedFrom && !dateFrom) || (requestedTo && !dateTo)) {
    throw new Error("Invalid date range. Use yyyy-mm-dd format.");
  }

  if (dateFrom && !dateTo) dateTo = dateFrom;
  if (!dateFrom && dateTo) dateFrom = dateTo;

  if (dateFrom && dateTo) {
    const fromStart = toDayStart(dateFrom);
    const toStart = toDayStart(dateTo);
    if (!fromStart || !toStart) {
      throw new Error("Invalid date range.");
    }
    if (fromStart.getTime() > toStart.getTime()) {
      const tmp = dateFrom;
      dateFrom = dateTo;
      dateTo = tmp;
    }
  }

  return {
    search,
    project_name: projectName,
    purchase_order_item_id: requestedItemId,
    statuses: requestedStatuses,
    date_from: dateFrom,
    date_to: dateTo,
  };
};

const buildInspectionWhere = (filters) => {
  const where = {};

  if (filters.date_from && filters.date_to) {
    const fromStart = toDayStart(filters.date_from);
    const toExclusive = toDayEndExclusive(filters.date_to);
    if (fromStart && toExclusive) {
      where.schedule_datetime = {
        [Op.gte]: fromStart,
        [Op.lt]: toExclusive,
      };
    }
  }

  return where;
};

const deriveReportBucket = (inspectionStatus, containsFailedTests) => {
  if (inspectionStatus === "completed") return "completed";
  if (containsFailedTests) return "failed";
  if (["failed", "rejected", "cancelled", "rework"].includes(inspectionStatus)) return "failed";
  return "active";
};

const deriveReportResult = (bucket, containsFailedTests) => {
  if (bucket === "completed") {
    return containsFailedTests ? "Completed with failed history" : "Passed";
  }
  if (bucket === "failed") return "Failed";
  return "In Progress";
};

const matchesProjectFilter = (report, projectName) => {
  if (!projectName) return true;
  return normalizeCompare(report.project_name) === normalizeCompare(projectName);
};

const matchesItemFilter = (report, itemId) => {
  if (!itemId) return true;
  return Number(report.purchase_order_item_id || 0) === Number(itemId || 0);
};

const matchesStatusFilter = (report, statuses = []) => {
  if (!Array.isArray(statuses) || statuses.length === 0) return true;

  const candidates = new Set([
    normalizeStatusFilter(report.status),
    normalizeStatusFilter(report.report_bucket),
  ]);

  return statuses.some((status) => candidates.has(normalizeStatusFilter(status)));
};

const buildSearchBlob = (report) => {
  const stageNames = report.stages.map((stage) => stage.stage_name).join(" ");
  const stageInspectors = report.stages.map((stage) => stage.inspector_name).join(" ");
  const testNames = report.stages.flatMap((stage) => stage.tests.map((test) => test.test_name)).join(" ");
  const testResults = report.stages.flatMap((stage) => stage.tests.map((test) => test.result || test.status)).join(" ");
  const testRemarks = report.stages.flatMap((stage) => stage.tests.map((test) => test.remarks || test.description)).join(" ");

  return [
    report.company_name,
    report.project_name,
    report.po_number,
    report.vendor_name,
    report.item_name,
    report.status,
    report.report_result,
    report.current_stage_name,
    report.current_stage_inspector,
    report.remarks,
    stageNames,
    stageInspectors,
    testNames,
    testResults,
    testRemarks,
  ]
    .map(normalizeCompare)
    .join(" ");
};

const matchesSearchFilter = (report, search) => {
  const normalizedSearch = normalizeCompare(search);
  if (!normalizedSearch) return true;
  return report._search_blob.includes(normalizedSearch);
};

const buildFilterOptions = (reports = []) => {
  const projectMap = new Map();
  const itemMap = new Map();

  for (const report of reports) {
    const projectKey = normalizeCompare(report.project_name);
    if (projectKey && !projectMap.has(projectKey)) {
      projectMap.set(projectKey, {
        project_name: report.project_name,
        company_name: report.company_name,
        report_count: 0,
      });
    }
    if (projectKey) {
      projectMap.get(projectKey).report_count += 1;
    }

    const itemId = Number(report.purchase_order_item_id || 0);
    if (itemId > 0 && !itemMap.has(itemId)) {
      itemMap.set(itemId, {
        purchase_order_item_id: itemId,
        item_name: report.item_name,
        project_name: report.project_name,
        po_number: report.po_number,
        company_name: report.company_name,
      });
    }
  }

  return {
    projects: Array.from(projectMap.values()).sort((left, right) =>
      `${left.project_name} ${left.company_name}`.localeCompare(`${right.project_name} ${right.company_name}`),
    ),
    items: Array.from(itemMap.values()).sort((left, right) =>
      `${left.project_name} ${left.item_name} ${left.po_number}`.localeCompare(
        `${right.project_name} ${right.item_name} ${right.po_number}`,
      ),
    ),
    statuses: [...new Set(reports.map((report) => report.report_bucket))].sort((left, right) => {
      const order = ["completed", "failed", "active"];
      return order.indexOf(left) - order.indexOf(right);
    }),
  };
};

const buildSummary = (reports = []) => ({
  totalReports: reports.length,
  completedReports: reports.filter((report) => report.report_bucket === "completed").length,
  failedReports: reports.filter((report) => report.report_bucket === "failed").length,
  activeReports: reports.filter((report) => report.report_bucket === "active").length,
  totalStages: reports.reduce((sum, report) => sum + Number(report.total_stages || 0), 0),
  totalTests: reports.reduce((sum, report) => sum + Number(report.total_tests || 0), 0),
  totalDocuments: reports.reduce((sum, report) => sum + Number(report.total_documents || 0), 0),
});

const stripPrivateFields = (report) => {
  const { _search_blob, _sort_at, ...publicReport } = report;
  return publicReport;
};

const escapePdfText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");

const wrapText = (value, maxLength = 104) => {
  const normalized = normalizeText(value);
  if (!normalized) return [""];

  const tokens = normalized.split(/\s+/);
  const lines = [];
  let current = "";

  for (const token of tokens) {
    if (token.length > maxLength) {
      if (current) {
        lines.push(current);
        current = "";
      }
      let remaining = token;
      while (remaining.length > maxLength) {
        lines.push(remaining.slice(0, maxLength));
        remaining = remaining.slice(maxLength);
      }
      current = remaining;
      continue;
    }

    const candidate = current ? `${current} ${token}` : token;
    if (candidate.length > maxLength) {
      lines.push(current);
      current = token;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const pushWrappedLabel = (lines, label, value, maxLength = 104) => {
  const normalized = normalizeText(value) || "-";
  const prefix = `${label}: `;
  const available = Math.max(10, maxLength - prefix.length);
  const wrapped = wrapText(normalized, available);
  wrapped.forEach((line, index) => {
    lines.push(index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`);
  });
};

const buildPdfDocument = (pageStreams) => {
  const pageWidth = 842;
  const pageHeight = 595;
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  const kids = [];
  pageStreams.forEach((stream, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    kids.push(`${pageObjectNumber} 0 R`);
    objects[pageObjectNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Count ${pageStreams.length} /Kids [${kids.join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
};

const buildTextPdfBuffer = ({ title, subtitleLines = [], bodyLines = [] }) => {
  const linesPerPage = 36;
  const headerLines = [title, ...subtitleLines, ""];
  const pages = [];
  let currentPage = [...headerLines];

  for (const line of bodyLines) {
    if (currentPage.length + 1 > linesPerPage) {
      pages.push(currentPage);
      currentPage = [...headerLines];
    }
    currentPage.push(line);
  }

  if (currentPage.length) {
    pages.push(currentPage);
  }

  const pageStreams = pages.map((lines, index) => {
    const footer = `Page ${index + 1} of ${pages.length}`;
    const outputLines = [...lines, "", footer];
    const commands = ["BT", "/F1 9 Tf", "28 560 Td"];

    outputLines.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push("0 -14 Td");
      commands.push(`(${escapePdfText(line)}) Tj`);
    });

    commands.push("ET");
    return commands.join("\n");
  });

  return buildPdfDocument(pageStreams);
};

const toSummaryExportRows = (reports = []) =>
  reports.map((report, index) => ({
    sl_no: index + 1,
    company_name: report.company_name || "",
    project_name: report.project_name || "",
    po_number: report.po_number || "",
    vendor_name: report.vendor_name || "",
    item_name: report.item_name || "",
    inspection_status: toTitleCase(report.status) || "",
    report_result: report.report_result || "",
    current_stage_name: report.current_stage_name || "",
    current_stage_inspector: report.current_stage_inspector || "",
    inspection_date: formatDateTime(report.inspection_date),
    completed_on: formatDateTime(report.completed_on),
    total_stages: Number(report.total_stages || 0),
    completed_stages: Number(report.completed_stages || 0),
    total_tests: Number(report.total_tests || 0),
    total_documents: Number(report.total_documents || 0),
    inspection_duration_days: Number(report.inspection_duration_days || 0),
    remarks: report.remarks || "",
  }));

const buildExcelBuffer = (reports, filters) => {
  const rows = toSummaryExportRows(reports);
  const selectedItem = reports.find(
    (report) => Number(report.purchase_order_item_id || 0) === Number(filters.purchase_order_item_id || 0),
  );

  const sheetRows = [
    ["Search", filters.search || ""],
    ["From Date", filters.date_from || "", "Till Date", filters.date_to || ""],
    ["Project", filters.project_name || "", "Item", selectedItem?.item_name || ""],
    [],
    SUMMARY_EXPORT_HEADERS,
    ...rows.map((row) => [
      row.sl_no,
      row.company_name,
      row.project_name,
      row.po_number,
      row.vendor_name,
      row.item_name,
      row.inspection_status,
      row.report_result,
      row.current_stage_name,
      row.current_stage_inspector,
      row.inspection_date,
      row.completed_on,
      row.total_stages,
      row.completed_stages,
      row.total_tests,
      row.total_documents,
      row.inspection_duration_days,
      row.remarks,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 18 },
    { wch: 26 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 36 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
};

const buildSummaryPdfBuffer = (reports, filters, summary) => {
  const selectedItem = reports.find(
    (report) => Number(report.purchase_order_item_id || 0) === Number(filters.purchase_order_item_id || 0),
  );

  const subtitleLines = [
    `Search: ${filters.search || "All"}`,
    `Date Range: ${filters.date_from || "All"} to ${filters.date_to || "All"}`,
    `Project: ${filters.project_name || "All"} | Item: ${selectedItem?.item_name || "All"}`,
    `Reports: ${summary.totalReports} | Completed: ${summary.completedReports} | Failed: ${summary.failedReports} | Active: ${summary.activeReports}`,
  ];

  const separator = "-".repeat(112);
  const bodyLines = [];

  if (!reports.length) {
    bodyLines.push("No reports available for the selected filters.");
  } else {
    reports.forEach((report, index) => {
      bodyLines.push(separator);
      bodyLines.push(
        `#${index + 1} ${report.project_name || "-"} | ${report.po_number || "-"} | ${report.item_name || "-"}`,
      );
      bodyLines.push(
        `Company: ${report.company_name || "-"} | Vendor: ${report.vendor_name || "-"} | Status: ${toTitleCase(report.status) || "-"}`,
      );
      bodyLines.push(
        `Result: ${report.report_result || "-"} | Current Stage: ${report.current_stage_name || "-"} | Inspector: ${report.current_stage_inspector || "-"}`,
      );
      bodyLines.push(
        `Inspection: ${formatDateTime(report.inspection_date) || "-"} | Completed: ${formatDateTime(report.completed_on) || "-"} | Tests: ${report.total_tests} | Docs: ${report.total_documents}`,
      );
      wrapText(`Remarks: ${report.remarks || "-"}`).forEach((line) => bodyLines.push(line));
    });
  }

  return buildTextPdfBuffer({
    title: "Inspection Report Summary",
    subtitleLines,
    bodyLines,
  });
};

const buildDetailedPdfBuffer = (report) => {
  const subtitleLines = [
    `Company: ${report.company_name || "-"}`,
    `Project: ${report.project_name || "-"} | PO: ${report.po_number || "-"}`,
    `Item: ${report.item_name || "-"} | Vendor: ${report.vendor_name || "-"}`,
    `Inspection Status: ${toTitleCase(report.status) || "-"} | Result: ${report.report_result || "-"}`,
  ];

  const separator = "-".repeat(112);
  const bodyLines = [];

  pushWrappedLabel(bodyLines, "Inspection Date", formatDateTime(report.inspection_date) || "-");
  pushWrappedLabel(bodyLines, "Assigned On", formatDateTime(report.assigned_on) || "-");
  pushWrappedLabel(bodyLines, "Completed On", formatDateTime(report.completed_on) || "-");
  pushWrappedLabel(
    bodyLines,
    "Summary",
    `Stages ${report.completed_stages}/${report.total_stages} | Tests ${report.total_tests} | Documents ${report.total_documents} | Days ${report.inspection_duration_days}`,
  );
  pushWrappedLabel(
    bodyLines,
    "Failed History",
    report.contains_failed_tests ? "Yes, this report contains failed/rework test history." : "No",
  );
  pushWrappedLabel(bodyLines, "Remarks", report.remarks || "-");
  bodyLines.push("");

  if (!report.stages.length) {
    bodyLines.push("No stage records available for this inspection item.");
  } else {
    report.stages.forEach((stage, stageIndex) => {
      bodyLines.push(separator);
      bodyLines.push(
        `Stage ${stageIndex + 1}: ${stage.stage_name || "-"} | Status: ${toTitleCase(stage.status) || "-"} | Tests: ${stage.tests_count} | Docs: ${stage.docs_count}`,
      );
      bodyLines.push(
        `Inspector: ${stage.inspector_name || "-"} | Started: ${formatDateTime(stage.started_on) || "-"} | Completed: ${formatDateTime(stage.completed_on) || "-"}`,
      );

      if (!stage.tests.length) {
        bodyLines.push("No tests recorded for this stage.");
        return;
      }

      stage.tests.forEach((testRow, testIndex) => {
        bodyLines.push(
          `  Test ${testIndex + 1}: ${testRow.test_name || "-"} | Status: ${toTitleCase(testRow.status) || "-"} | Result: ${toTitleCase(testRow.result) || "-"} | Pass Qty: ${testRow.pass_quantity} | Fail Qty: ${testRow.fail_quantity}`,
        );
        bodyLines.push(
          `    Reported On: ${formatDateTime(testRow.reported_on) || "-"} | Documents: ${testRow.docs_count}`,
        );
        if (testRow.remarks) {
          wrapText(`    Remarks: ${testRow.remarks}`, 100).forEach((line) => bodyLines.push(line));
        }
        if (testRow.description) {
          wrapText(`    Description: ${testRow.description}`, 100).forEach((line) => bodyLines.push(line));
        }
        if (testRow.gps_location) {
          wrapText(`    GPS: ${testRow.gps_location}`, 100).forEach((line) => bodyLines.push(line));
        }
        if (Array.isArray(testRow.documents) && testRow.documents.length > 0) {
          bodyLines.push("    Documents:");
          testRow.documents.forEach((document, documentIndex) => {
            wrapText(`      ${documentIndex + 1}. ${document.name || `Document ${documentIndex + 1}`}`, 96).forEach((line) =>
              bodyLines.push(line),
            );
            wrapText(`         ${document.url}`, 94).forEach((line) => bodyLines.push(line));
          });
        }
      });
    });
  }

  return buildTextPdfBuffer({
    title: report.report_bucket === "completed" ? "Completed Inspection Report" : "Detailed Inspection Report",
    subtitleLines,
    bodyLines,
  });
};

const buildStageReport = (stageRow, stageTests, inspection, publicBaseUrl) => {
  const tests = (stageTests || [])
    .map((row) => {
      const testId = Number(row?.test_id || row?.Test?.id || 0);
      if (!testId) return null;

      const execution = mapStageTestExecution(row);
      const documents = normalizeDocuments(row.documents, publicBaseUrl);

      return {
        history_id: Number(row.id || 0),
        test_id: testId,
        test_name: normalizeText(row?.Test?.test_name || `Test ${testId}`),
        status: execution.status,
        result: execution.result,
        quantity: execution.quantity,
        pass_quantity: execution.pass_quantity,
        fail_quantity: execution.fail_quantity,
        remarks: normalizeText(row?.remark),
        description: normalizeText(row?.description),
        gps_location: normalizeText(row?.gps_location),
        docs_count: documents.length,
        reported_on: pickLastValidDate([row.updatedAt, row.createdAt]) || null,
        documents,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const testCompare = Number(left.test_id || 0) - Number(right.test_id || 0);
      if (testCompare !== 0) return testCompare;
      return Number(left.history_id || 0) - Number(right.history_id || 0);
    });

  const stageStartedOn =
    pickFirstValidDate([...tests.map((testRow) => testRow.reported_on), stageRow.createdAt, inspection?.createdAt]) || null;
  const stageCompletedOn =
    pickLastValidDate([
      ...tests.map((testRow) => testRow.reported_on),
      stageRow.updatedAt,
      stageRow.createdAt,
      inspection?.updatedAt,
    ]) || null;

  return {
    stage_id: Number(stageRow.stage_id || stageRow?.Stage?.id || 0) || null,
    po_stage_id: Number(stageRow.id || 0) || null,
    stage_name: normalizeText(stageRow?.Stage?.stage_name || `Stage ${stageRow.stage_id || "-"}`),
    status: normalizeReportStageStatus(stageRow.status),
    batch_id: Number(stageRow.batch_id || 0) || null,
    inspector_name: resolveInspectorName(stageRow, inspection),
    started_on: stageStartedOn,
    completed_on: stageCompletedOn,
    duration_days: calculateDurationDays(stageStartedOn, stageCompletedOn),
    updated_at: stageCompletedOn || stageRow.updatedAt || null,
    tests_count: tests.length,
    docs_count: tests.reduce((sum, testRow) => sum + Number(testRow.docs_count || 0), 0),
    tests,
  };
};

const fetchAllReports = async (req, filters) => {
  const publicBaseUrl = getPublicBaseUrl(req);
  const inspectionWhere = buildInspectionWhere(filters);

  const inspections = await Inspection.findAll({
    where: inspectionWhere,
    attributes: [
      "id",
      "po_id",
      "assignment_id",
      "purchase_order_item_id",
      "schedule_datetime",
      "status",
      "remarks",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: PurchaseOrder,
        as: "PO",
        attributes: ["id", "po_number", "project_name", "po_date", "delivery_date", "attachment", "design_copy"],
        required: false,
        include: [
          {
            model: Project,
            attributes: ["id", "project_name", "company_id"],
            required: false,
            include: [{ model: Company, attributes: ["id", "company_name"], required: false }],
          },
          {
            model: Company,
            as: "Companies",
            through: { attributes: [] },
            attributes: ["id", "company_name"],
            required: false,
          },
          {
            model: Vendor,
            attributes: ["id", "vendor_name"],
            required: false,
          },
        ],
      },
      {
        model: User,
        as: "Inspector",
        attributes: ["id", "name", "email"],
        required: false,
      },
      {
        model: PurchaseOrderItem,
        as: "PoItem",
        attributes: ["id", "quantity", "po_id"],
        required: false,
        include: [
          {
            model: Items,
            attributes: ["id", "item_name"],
            required: false,
          },
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "project_name", "po_date", "delivery_date", "attachment", "design_copy"],
            required: false,
            include: [
              {
                model: Project,
                attributes: ["id", "project_name", "company_id"],
                required: false,
                include: [{ model: Company, attributes: ["id", "company_name"], required: false }],
              },
              {
                model: Company,
                as: "Companies",
                through: { attributes: [] },
                attributes: ["id", "company_name"],
                required: false,
              },
              {
                model: Vendor,
                attributes: ["id", "vendor_name"],
                required: false,
              },
            ],
          },
        ],
      },
    ],
    order: [
      ["schedule_datetime", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  const inspectionRows = Array.isArray(inspections) ? inspections : [];
  const assignmentIds = [...new Set(inspectionRows.map((row) => Number(row.assignment_id || 0)).filter(Boolean))];

  const assignmentRows = assignmentIds.length
    ? await InspectionAssignment.findAll({
        where: { id: { [Op.in]: assignmentIds } },
        attributes: ["id", "scheduled_on", "status", "createdAt", "updatedAt"],
        raw: true,
      })
    : [];

  const assignmentById = new Map(assignmentRows.map((row) => [Number(row.id || 0), row]));

  const missingItemAssignmentIds = [
    ...new Set(
      inspectionRows
        .filter((row) => !row?.PoItem && Number(row?.assignment_id || 0) > 0)
        .map((row) => Number(row.assignment_id || 0))
        .filter(Boolean),
    ),
  ];

  const fallbackPoItemByAssignmentId = new Map();
  if (missingItemAssignmentIds.length > 0) {
    const assignmentItems = await InspectionAssignmentItem.findAll({
      where: { assignment_id: { [Op.in]: missingItemAssignmentIds } },
      attributes: ["assignment_id", "purchase_order_item_id", "status", "updatedAt"],
    });

    const groupedByAssignmentId = new Map();
    for (const row of assignmentItems) {
      const assignmentId = Number(row.assignment_id || 0);
      if (!assignmentId) continue;
      if (!groupedByAssignmentId.has(assignmentId)) groupedByAssignmentId.set(assignmentId, []);
      groupedByAssignmentId.get(assignmentId).push(row);
    }

    const preferredPoItemIds = [];
    const preferredPoItemByAssignmentId = new Map();
    for (const assignmentId of missingItemAssignmentIds) {
      const preferred = pickPreferredAssignmentItem(groupedByAssignmentId.get(assignmentId) || []);
      const poItemId = Number(preferred?.purchase_order_item_id || 0) || null;
      if (!poItemId) continue;
      preferredPoItemByAssignmentId.set(assignmentId, poItemId);
      preferredPoItemIds.push(poItemId);
    }

    if (preferredPoItemIds.length > 0) {
      const fallbackPoItems = await PurchaseOrderItem.findAll({
        where: { id: { [Op.in]: [...new Set(preferredPoItemIds)] } },
        attributes: ["id", "quantity", "po_id"],
        include: [
          {
            model: Items,
            attributes: ["id", "item_name"],
            required: false,
          },
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number", "project_name", "po_date", "delivery_date", "attachment", "design_copy"],
            required: false,
            include: [
              {
                model: Project,
                attributes: ["id", "project_name", "company_id"],
                required: false,
                include: [{ model: Company, attributes: ["id", "company_name"], required: false }],
              },
              {
                model: Company,
                as: "Companies",
                through: { attributes: [] },
                attributes: ["id", "company_name"],
                required: false,
              },
              {
                model: Vendor,
                attributes: ["id", "vendor_name"],
                required: false,
              },
            ],
          },
        ],
      });

      const fallbackPoItemsById = new Map(fallbackPoItems.map((row) => [Number(row.id), row]));
      for (const [assignmentId, poItemId] of preferredPoItemByAssignmentId.entries()) {
        const resolvedPoItem = fallbackPoItemsById.get(Number(poItemId));
        if (resolvedPoItem) {
          fallbackPoItemByAssignmentId.set(Number(assignmentId), resolvedPoItem);
        }
      }
    }
  }

  const inspectionIds = inspectionRows.map((row) => Number(row.id || 0)).filter(Boolean);
  const poStageRows = inspectionIds.length
    ? await PoStage.findAll({
        where: { inspection_id: { [Op.in]: inspectionIds } },
        attributes: ["id", "inspection_id", "item_id", "stage_id", "status", "batch_id", "createdAt", "updatedAt"],
        include: [
          {
            model: Stage,
            attributes: ["id", "stage_name"],
            required: false,
          },
          {
            model: User,
            as: "StageInspector",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],
        order: [
          ["inspection_id", "DESC"],
          ["item_id", "ASC"],
          ["stage_id", "ASC"],
          ["updatedAt", "ASC"],
          ["id", "ASC"],
        ],
      })
    : [];

  const stageRowsByInspectionItem = new Map();
  const stageRowsByInspectionId = new Map();
  for (const stageRow of poStageRows) {
    const inspectionId = Number(stageRow.inspection_id || 0);
    const itemId = Number(stageRow.item_id || 0);
    if (inspectionId) {
      if (!stageRowsByInspectionId.has(inspectionId)) stageRowsByInspectionId.set(inspectionId, []);
      stageRowsByInspectionId.get(inspectionId).push(stageRow);
    }
    if (inspectionId && itemId) {
      const key = `${inspectionId}_${itemId}`;
      if (!stageRowsByInspectionItem.has(key)) stageRowsByInspectionItem.set(key, []);
      stageRowsByInspectionItem.get(key).push(stageRow);
    }
  }

  const additionalPoItemIds = [
    ...new Set(
      inspectionRows
        .filter((inspection) => !inspection?.PoItem && !fallbackPoItemByAssignmentId.get(Number(inspection.assignment_id || 0)))
        .flatMap((inspection) => stageRowsByInspectionId.get(Number(inspection.id || 0)) || [])
        .map((row) => Number(row.item_id || 0))
        .filter(Boolean),
    ),
  ];

  const additionalPoItemById = new Map();
  if (additionalPoItemIds.length > 0) {
    const extraPoItems = await PurchaseOrderItem.findAll({
      where: { id: { [Op.in]: additionalPoItemIds } },
      attributes: ["id", "quantity", "po_id"],
      include: [
        {
          model: Items,
          attributes: ["id", "item_name"],
          required: false,
        },
        {
          model: PurchaseOrder,
          attributes: ["id", "po_number", "project_name", "po_date", "delivery_date", "attachment", "design_copy"],
          required: false,
          include: [
            {
              model: Project,
              attributes: ["id", "project_name", "company_id"],
              required: false,
              include: [{ model: Company, attributes: ["id", "company_name"], required: false }],
            },
            {
              model: Company,
              as: "Companies",
              through: { attributes: [] },
              attributes: ["id", "company_name"],
              required: false,
            },
            {
              model: Vendor,
              attributes: ["id", "vendor_name"],
              required: false,
            },
          ],
        },
      ],
    });

    extraPoItems.forEach((row) => {
      additionalPoItemById.set(Number(row.id || 0), row);
    });
  }

  const poStageIds = [...new Set(poStageRows.map((row) => Number(row.id || 0)).filter(Boolean))];
  const stageTestRows = poStageIds.length
    ? await StageTest.findAll({
        where: { po_stage_id: { [Op.in]: poStageIds } },
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
          "documents",
          "createdAt",
          "updatedAt",
        ],
        include: [{ model: Test, attributes: ["id", "test_name"], required: false }],
        order: [
          ["po_stage_id", "ASC"],
          ["test_id", "ASC"],
          ["updatedAt", "ASC"],
          ["id", "ASC"],
        ],
      })
    : [];

  const stageTestsByPoStageId = new Map();
  for (const row of stageTestRows) {
    const poStageId = Number(row.po_stage_id || 0);
    if (!poStageId) continue;
    if (!stageTestsByPoStageId.has(poStageId)) stageTestsByPoStageId.set(poStageId, []);
    stageTestsByPoStageId.get(poStageId).push(row);
  }

  const reports = inspectionRows
    .map((inspection) => {
      const assignmentId = Number(inspection.assignment_id || 0) || null;
      const stageCandidates = stageRowsByInspectionId.get(Number(inspection.id || 0)) || [];
      const fallbackStageItemId = Number(stageCandidates[0]?.item_id || 0) || null;

      const resolvedPoItem =
        inspection.PoItem ||
        fallbackPoItemByAssignmentId.get(Number(assignmentId || 0)) ||
        additionalPoItemById.get(fallbackStageItemId || 0) ||
        null;
      const resolvedPoItemId =
        Number(inspection.purchase_order_item_id || resolvedPoItem?.id || fallbackStageItemId || 0) || null;

      const po = inspection.PO || resolvedPoItem?.PurchaseOrder || null;
      const companyName = resolveCompanyName(po);
      const projectName = resolveProjectName(po);
      const stageRows =
        (resolvedPoItemId ? stageRowsByInspectionItem.get(`${Number(inspection.id || 0)}_${resolvedPoItemId}`) : null) ||
        stageRowsByInspectionId.get(Number(inspection.id || 0)) ||
        [];

      const stages = stageRows
        .map((stageRow) =>
          buildStageReport(stageRow, stageTestsByPoStageId.get(Number(stageRow.id || 0)) || [], inspection, publicBaseUrl),
        )
        .sort((left, right) => {
          const stageCompare = Number(left.stage_id || 0) - Number(right.stage_id || 0);
          if (stageCompare !== 0) return stageCompare;
          return toValidTimestamp(left.updated_at) - toValidTimestamp(right.updated_at);
        });

      const latestStage = [...stages].sort(
        (left, right) => toValidTimestamp(right.updated_at) - toValidTimestamp(left.updated_at),
      )[0] || null;
      const normalizedStatus = normalizeStatusFilter(inspection.status || "") || "assigned";
      const containsFailedTests =
        stages.some((stage) =>
          stage.tests.some((testRow) => ["failed", "rework"].includes(normalizeReportStageStatus(testRow.status))),
        ) || ["failed", "rejected", "cancelled", "rework"].includes(normalizedStatus);
      const reportBucket = deriveReportBucket(normalizedStatus, containsFailedTests);
      const reportResult = deriveReportResult(reportBucket, containsFailedTests);
      const assignment = assignmentById.get(Number(assignmentId || 0)) || null;

      const assignedOn = assignment?.scheduled_on || inspection.schedule_datetime || null;
      const inspectionStartedOn =
        pickFirstValidDate([inspection.createdAt, inspection.schedule_datetime, assignment?.createdAt, assignedOn]) || null;
      const completedOn =
        normalizedStatus === "completed"
          ? pickLastValidDate([inspection.updatedAt, latestStage?.updated_at, inspection.schedule_datetime])
          : pickLastValidDate([latestStage?.updated_at, inspection.updatedAt]);
      const latestActivityAt =
        pickLastValidDate([completedOn, latestStage?.updated_at, inspection.updatedAt, inspection.schedule_datetime]) || null;
      const currentStageName = latestStage?.stage_name || (normalizedStatus ? toTitleCase(normalizedStatus) : "Pending");
      const currentStageInspector = latestStage?.inspector_name || resolveInspectorName(null, inspection);
      const currentStageResult = latestStage?.status ? toTitleCase(latestStage.status) : reportResult;
      const totalStages = stages.length;
      const completedStages = stages.filter((stage) => normalizeReportStageStatus(stage.status) === "completed").length;
      const totalTests = stages.reduce((sum, stage) => sum + Number(stage.tests_count || 0), 0);
      const totalDocuments = stages.reduce((sum, stage) => sum + Number(stage.docs_count || 0), 0);
      const remarks = dedupeTextJoin([
        inspection.remarks,
        ...stages.flatMap((stage) => stage.tests.flatMap((testRow) => [testRow.remarks, testRow.description])),
      ]);

      const poAttachments = normalizePoAttachments(po?.attachment);
      const poDesignCopies = normalizePoDesignCopies(po?.design_copy);
      const report = {
        report_key: `${Number(inspection.id || 0)}_${Number(resolvedPoItemId || 0) || "na"}`,
        inspection_id: Number(inspection.id || 0),
        assignment_id: assignmentId,
        po_id: Number(po?.id || inspection.po_id || resolvedPoItem?.po_id || 0) || null,
        purchase_order_item_id: resolvedPoItemId,
        company_name: companyName,
        project_name: projectName,
        po_number: normalizeText(po?.po_number),
        po_date: formatDate(po?.po_date),
        delivery_date: formatDate(po?.delivery_date),
        vendor_name: normalizeText(po?.Vendor?.vendor_name),
        item_name: normalizeText(getPoItemName(resolvedPoItem) || (resolvedPoItemId ? `Item #${resolvedPoItemId}` : "")),
        status: normalizedStatus,
        report_bucket: reportBucket,
        report_result: reportResult,
        contains_failed_tests: containsFailedTests,
        current_stage_name: currentStageName,
        current_stage_result: currentStageResult,
        current_stage_inspector: currentStageInspector,
        inspection_date: inspection.schedule_datetime || null,
        assigned_on: assignedOn || null,
        inspection_started_on: inspectionStartedOn,
        completed_on: completedOn,
        inspection_duration_days: calculateDurationDays(
          inspectionStartedOn,
          completedOn || latestActivityAt || inspection.schedule_datetime || assignedOn,
        ),
        total_stages: totalStages,
        completed_stages: completedStages,
        total_tests: totalTests,
        total_documents: totalDocuments,
        remarks,
        attachment: poAttachments.attachment,
        attachments: poAttachments.attachments,
        design_copy: poDesignCopies.design_copy,
        design_copies: poDesignCopies.design_copies,
        latest_activity_at: latestActivityAt,
        stages,
      };

      return {
        ...report,
        _search_blob: buildSearchBlob(report),
        _sort_at: toValidTimestamp(latestActivityAt || inspection.updatedAt || inspection.schedule_datetime || inspection.createdAt),
      };
    })
    .sort((left, right) => right._sort_at - left._sort_at);

  return {
    reports,
    filterOptions: buildFilterOptions(reports),
  };
};

const getReportPayload = async (req, query = {}) => {
  const filters = parseReportFilters(query);
  const { reports: allReports, filterOptions } = await fetchAllReports(req, filters);

  const filteredReports = allReports.filter((report) => {
    if (!matchesProjectFilter(report, filters.project_name)) return false;
    if (!matchesItemFilter(report, filters.purchase_order_item_id)) return false;
    if (!matchesStatusFilter(report, filters.statuses)) return false;
    if (!matchesSearchFilter(report, filters.search)) return false;
    return true;
  });

  return {
    allReports,
    filteredReports,
    summary: buildSummary(filteredReports),
    filterOptions,
    appliedFilters: filters,
  };
};

const requireDetailedReportSelection = (query = {}) => {
  const inspectionId = Number(query.inspection_id || 0) || null;
  const purchaseOrderItemId = Number(query.purchase_order_item_id || 0) || null;
  return { inspectionId, purchaseOrderItemId };
};

export default class AdminReportController {
  static async list(req, res) {
    try {
      const payload = await getReportPayload(req, req.query || {});

      return res.json({
        success: true,
        data: payload.filteredReports.map(stripPrivateFields),
        summary: payload.summary,
        filterOptions: payload.filterOptions,
        appliedFilters: payload.appliedFilters,
      });
    } catch (error) {
      const message =
        error?.message === "Invalid purchase_order_item_id filter." ||
        String(error?.message || "").startsWith("Invalid date range")
          ? error.message
          : "Unable to load reports";

      if (message !== "Unable to load reports") {
        return res.status(400).json({ success: false, message });
      }

      console.error("AdminReport list:", error);
      return res.status(500).json({ success: false, message });
    }
  }

  static async export(req, res) {
    try {
      const format = normalizeCompare(req.query.format || "xlsx");
      if (!["xlsx", "pdf"].includes(format)) {
        return res.status(400).json({ success: false, message: "format must be xlsx or pdf" });
      }

      const scope = normalizeCompare(req.query.scope || "summary");
      const payload = await getReportPayload(req, req.query || {});
      const dateStamp = new Date().toISOString().slice(0, 10);

      if (scope === "detailed") {
        if (format !== "pdf") {
          return res.status(400).json({ success: false, message: "Detailed export supports pdf only" });
        }

        const { inspectionId, purchaseOrderItemId } = requireDetailedReportSelection(req.query || {});
        const selectedReport = payload.filteredReports.find((report) => {
          const inspectionMatches = inspectionId ? Number(report.inspection_id || 0) === inspectionId : true;
          const itemMatches = purchaseOrderItemId
            ? Number(report.purchase_order_item_id || 0) === purchaseOrderItemId
            : true;
          return inspectionMatches && itemMatches;
        });

        if (!selectedReport) {
          return res.status(404).json({ success: false, message: "Requested report not found" });
        }

        const buffer = buildDetailedPdfBuffer(selectedReport);
        const fileLabel = selectedReport.report_bucket === "completed" ? "completed-report" : "detailed-report";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=inspection-${fileLabel}-${selectedReport.inspection_id}-${dateStamp}.pdf`,
        );
        return res.send(buffer);
      }

      if (format === "xlsx") {
        const buffer = buildExcelBuffer(payload.filteredReports.map(stripPrivateFields), payload.appliedFilters);
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader("Content-Disposition", `attachment; filename=inspection-report-${dateStamp}.xlsx`);
        return res.send(buffer);
      }

      const buffer = buildSummaryPdfBuffer(
        payload.filteredReports.map(stripPrivateFields),
        payload.appliedFilters,
        payload.summary,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=inspection-report-${dateStamp}.pdf`);
      return res.send(buffer);
    } catch (error) {
      const message =
        error?.message === "Invalid purchase_order_item_id filter." ||
        String(error?.message || "").startsWith("Invalid date range")
          ? error.message
          : "Unable to export reports";

      if (message !== "Unable to export reports") {
        return res.status(400).json({ success: false, message });
      }

      console.error("AdminReport export:", error);
      return res.status(500).json({ success: false, message });
    }
  }
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = ["pending", "assigned", "in_progress", "rescheduled", "completed", "cancelled", "rejected"];
const INSPECTION_ACTION_PERMISSIONS = [
  "assigninspection_po",
  "reschedule_inspection",
  "reschedule_inspection_item",
  "cancel_inspection_item",
  "cancel_inspection",
  "manage_inspection",
  "manage_all_inspections",
];

export default function CurrentInspection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { permissions } = useAuth();

  const [rows, setRows] = useState<any[]>([]);
  const initialStatus = searchParams.get("status") || "in_progress";
  const [status, setStatus] = useState(
    STATUS_OPTIONS.includes(initialStatus) ? initialStatus : "in_progress",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionRow, setActionRow] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"reschedule" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const rescheduleQueue = searchParams.get("queue") === "reschedule";
  const hasAnyPermission = (required: string[]) =>
    permissions.some((p: string) => p === "*" || required.includes(p));
  const canRescheduleInspection = hasAnyPermission([
    "assigninspection_po",
    "reschedule_inspection",
    "reschedule_inspection_item",
    "manage_inspection",
    "manage_all_inspections",
  ]);
  const canCancelInspection = hasAnyPermission([
    "assigninspection_po",
    "cancel_inspection",
    "cancel_inspection_item",
    "manage_inspection",
    "manage_all_inspections",
  ]);
  const canManageInspection =
    permissions.some((p: string) => INSPECTION_ACTION_PERMISSIONS.includes(p) || p === "*") &&
    (canRescheduleInspection || canCancelInspection);

  const normalizeResultValue = (value: unknown) => String(value || "").trim().toLowerCase();
  const normalizeStatusValue = (value: unknown) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!normalized) return "";
    if (normalized === "inprocess" || normalized === "in_process") return "in_progress";
    return normalized;
  };
  const normalizeRowStatus = (row: any) => {
    const candidates = [
      row?.status,
      row?.actual_status,
      row?.inspection_status,
      row?.assignment_status,
      row?.batch_status,
      row?.type,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeStatusValue(candidate);
      if (normalized) return normalized;
    }

    return "";
  };
  const resolveInspectorName = (row: any) =>
    row?.inspector?.name ||
    row?.inspector_name ||
    row?.Inspector?.name ||
    row?.Inspector?.email ||
    "";
  const normalizeRowResult = (row: any) => {
    const candidates = [
      row?.result,
      row?.test_result,
      row?.inspection_result,
      row?.final_result,
      row?.latest_result,
      row?.qc_result,
      row?.outcome,
      row?.test_outcome,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeResultValue(candidate);
      if (normalized) return normalized;
    }

    return "";
  };

  const isRejectedRow = (row: any) => {
    const status = normalizeRowStatus(row);
    const result = normalizeRowResult(row);
    const rawType = normalizeResultValue(row?.actual_status || row?.type || "");

    if (
      result.includes("reject") ||
      row?.is_rejected === true ||
      row?.rejected_once === true ||
      row?.has_rejected_test === true ||
      rawType.includes("reject") ||
      status === "rejected"
    ) {
      return true;
    }

    return false;
  };

  const isRejectedByTest = (row: any) => {
    const status = normalizeRowStatus(row);
    const result = normalizeRowResult(row);
    const rawType = normalizeResultValue(row?.actual_status || row?.type || "");

    if (isRejectedRow(row)) return true;

    if (
      result === "fail" ||
      result === "failed" ||
      result === "ng" ||
      result === "not_ok" ||
      row?.has_failed_test === true ||
      row?.any_test_failed === true ||
      rawType === "failed" ||
      rawType === "fail"
    ) {
      return true;
    }

    return status === "failed";
  };

  const displayStatus = (row: any) => {
    const normalizedStatus = normalizeRowStatus(row);
    if (normalizedStatus === "cancelled") return "cancelled";
    if (isRejectedRow(row)) return "rejected";
    if (normalizedStatus === "completed") return "completed";
    if (normalizedStatus === "rescheduled") return "rescheduled";
    if (normalizedStatus) return normalizedStatus;
    if (isRejectedByTest(row)) return "failed";
    return "pending";
  };
  const displayResult = (row: any) => {
    const result = normalizeRowResult(row);
    if (result) return result;
    const rowStatus = displayStatus(row);
    if (rowStatus === "rejected") return "reject";
    if (rowStatus === "completed") return "pass";
    if (rowStatus === "cancelled") return "cancelled";
    if (rowStatus === "rescheduled") return "rescheduled";
    if (rowStatus === "failed") return "fail";
    return "pending";
  };

  const mapRescheduleQueueRows = (inputRows: any[]) =>
    (Array.isArray(inputRows) ? inputRows : []).map((row: any, index: number) => {
      const inspectionId = Number(row?.inspection_id || 0) || null;
      const assignmentId = Number(row?.assignment_id || 0) || null;
      const poItemId = Number(row?.purchase_order_item_id || 0) || null;
      const rawType = String(row?.type || row?.status || "cancelled").trim().toLowerCase();
      const mappedStatus =
        rawType === "missed"
          ? "missed"
          : rawType === "rejected"
            ? "rejected"
            : normalizeStatusValue(row?.status || rawType) || "cancelled";
      const syntheticId = inspectionId || assignmentId || index + 1;
      const inspectorName = resolveInspectorName(row);

      return {
        id: syntheticId,
        row_key: `${inspectionId || "na"}_${assignmentId || "na"}_${poItemId || "na"}_${index}`,
        inspection_id: inspectionId,
        assignment_id: assignmentId,
        purchase_order_item_id: poItemId,
        schedule_datetime: row?.scheduled_on || row?.schedule_datetime || null,
        status: mappedStatus,
        inspection_location: null,
        po: {
          po_number: row?.po_number || "-",
          vendor_name: row?.vendor_name || "-",
        },
        inspector: inspectorName
          ? {
              id: Number(row?.inspector_id || row?.inspector?.id || 0) || null,
              name: inspectorName,
            }
          : null,
        inspector_name: inspectorName || null,
        item: poItemId || row?.item_name
          ? {
              id: poItemId,
              item_name: row?.item_name || (poItemId ? `Item #${poItemId}` : null),
            }
          : null,
        result: row?.result || row?.test_result || null,
        actual_status: rawType,
        cancel_reason: row?.cancel_reason || null,
        remarks: row?.cancel_reason || null,
      };
    });

  async function load() {
    setLoading(true);
    try {
      if (rescheduleQueue) {
        const res = await api.get("/inspections/cancelled");
        const queueRows = mapRescheduleQueueRows(res.data?.data || []).filter((row) => !isRejectedRow(row));
        setRows(queueRows);
      } else {
        const requestedStatus =
          status === "cancelled"
            ? "cancelled,rescheduled,in_progress,assigned,pending"
            : status === "rejected"
              ? "rejected,in_progress,assigned,pending,rescheduled"
              : status === "completed"
                ? "completed,in_progress,assigned,pending,rescheduled"
                : status;
        const requestedLimit = ["cancelled", "rejected", "completed"].includes(status) ? 100 : 30;
        const res = await api.get("/admin/inspections", {
          params: { status: requestedStatus, search, page: 1, limit: requestedLimit },
        });
        setRows(res.data?.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  const isInProgressLike = (row: any) => {
    const rowStatus = displayStatus(row);
    if (rowStatus !== "in_progress" && rowStatus !== "in_process") return false;

    const startedFieldKeys = ["started_at", "started_on", "actual_start", "inspection_started_at"];
    const hasStartedField = startedFieldKeys.some((key) => key in (row || {}));
    if (hasStartedField) {
      const startedRaw =
        row?.started_at ?? row?.started_on ?? row?.actual_start ?? row?.inspection_started_at;
      if (!startedRaw) return false;
    }

    return true;
  };

  const isRescheduleEligible = (row: any) => {
    if (isRejectedByTest(row)) return false;
    const rowStatus = displayStatus(row);
    if (["assigned", "cancelled", "rescheduled", "missed"].includes(rowStatus)) return true;
    return isInProgressLike(row);
  };

  const isCancelEligible = (row: any) => {
    if (isRejectedByTest(row)) return false;
    const rowStatus = displayStatus(row);
    if (["assigned", "rescheduled"].includes(rowStatus)) return true;
    return isInProgressLike(row);
  };

  const visibleRows = useMemo(() => {
    if (rescheduleQueue) return rows;

    return rows.filter((row) => {
      const rowStatus = displayStatus(row);

      if (status === "completed") return rowStatus === "completed";
      if (status === "rejected") return rowStatus === "rejected";
      if (status === "cancelled") return rowStatus === "cancelled" || rowStatus === "rescheduled";
      if (status === "rescheduled") return rowStatus === "rescheduled";
      if (status === "assigned") return rowStatus === "assigned";
      if (status === "pending") return rowStatus === "pending";

      return ["in_progress", "in_process", "assigned", "active", "rescheduled"].includes(rowStatus);
    });
  }, [rows, rescheduleQueue, status]);

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "in_progress";
    setStatus(STATUS_OPTIONS.includes(nextStatus) ? nextStatus : "in_progress");
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [status, rescheduleQueue]);

  const statusClass = (value: string) => {
    const s = (value || "").toLowerCase();
    if (s === "completed") return "bg-emerald-100 text-emerald-700";
    if (s === "cancelled") return "bg-rose-100 text-rose-700";
    if (s === "rejected" || s === "failed") return "bg-rose-100 text-rose-700";
    if (s === "missed") return "bg-orange-100 text-orange-700";
    if (s === "rescheduled") return "bg-amber-100 text-amber-700";
    return "bg-sky-100 text-sky-700";
  };

  const resultClass = (row: any) => {
    const result = displayResult(row);
    if (result.includes("reject") || result === "fail" || result === "failed" || result === "ng") {
      return "bg-rose-100 text-rose-700";
    }
    if (result === "pass" || result === "passed" || result === "ok") {
      return "bg-emerald-100 text-emerald-700";
    }
    return "bg-slate-100 text-slate-700";
  };

  const openReschedule = (row: any) => {
    if (!canManageInspection || !canRescheduleInspection || !isRescheduleEligible(row)) return;
    setActionRow(row);
    setActionType("reschedule");
    setReason("");
    setScheduleDate("");
    setActionError("");
  };

  const openCancel = (row: any) => {
    if (!canManageInspection || !canCancelInspection || !isCancelEligible(row)) return;
    setActionRow(row);
    setActionType("cancel");
    setReason("");
    setScheduleDate("");
    setActionError("");
  };

  const closeModal = () => {
    if (submitting) return;
    setActionRow(null);
    setActionType(null);
    setReason("");
    setScheduleDate("");
    setActionError("");
  };

  const submitAction = async () => {
    if (!actionRow || !actionType) return;
    if (actionType === "cancel" && !canCancelInspection) return;
    if (actionType === "reschedule" && !canRescheduleInspection) return;
    const inspectionId = Number(actionRow?.inspection_id || actionRow?.id || 0);
    const itemId = Number(actionRow?.item?.id || actionRow?.purchase_order_item_id || 0);
    const assignmentId = Number(actionRow?.assignment_id || 0);

    if (!reason.trim()) return;
    if (actionType === "reschedule" && !scheduleDate) return;

    setSubmitting(true);
    try {
      if (actionType === "cancel") {
        if (inspectionId && itemId) {
          await api.post("/inspection/cancel-item", {
            inspection_id: inspectionId,
            purchase_order_item_id: itemId,
            reason: reason.trim(),
          });
        } else if (assignmentId) {
          await api.post("/inspection/cancel", {
            assignment_id: assignmentId,
            reason: reason.trim(),
          });
        } else {
          setActionError("Unable to resolve item/assignment for cancel.");
          return;
        }
      } else {
        if (inspectionId && itemId) {
          await api.post("/inspection/reschedule-item", {
            inspection_id: inspectionId,
            purchase_order_item_id: itemId,
            schedule_datetime: scheduleDate,
            reason: reason.trim(),
          });
        } else if (assignmentId) {
          await api.post("/inspections/reschedule-page", {
            assignment_id: assignmentId,
            schedule_datetime: scheduleDate,
            reason: reason.trim(),
          });
        } else {
          setActionError("Unable to resolve item/assignment for reschedule.");
          return;
        }
      }
      closeModal();
      load();
    } catch (e: any) {
      setActionError(e?.response?.data?.message || "Unable to update inspection item.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operations</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-800">Current Inspections</h2>
            <p className="mt-1 text-sm text-slate-500">
              Track live inspection progress and quickly move to detail view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Total Records: {visibleRows.length}
            </span>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
              Status: {rescheduleQueue ? "reschedule queue" : status.replace("_", " ")}
            </span>
            {rescheduleQueue && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                Reschedule Queue
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        {!canManageInspection && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            You can view inspections, but reschedule/cancel requires additional permission.
          </div>
        )}
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_130px]">
          <select
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:bg-white"
            value={status}
            disabled={rescheduleQueue}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>

          <input
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:bg-white"
            placeholder={rescheduleQueue ? "Search disabled in reschedule queue" : "Search PO Number"}
            value={search}
            disabled={rescheduleQueue}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            onClick={load}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500">
            Loading inspections...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-700">
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">ID</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">PO</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Vendor</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Inspector</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Item</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Result</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Reason</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Schedule Date</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Status</th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, idx) => (
                  <tr
                    key={r.row_key || r.id}
                    className={`cursor-pointer border-b border-slate-100 transition hover:bg-sky-50/60 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                    onClick={() => (rescheduleQueue ? openReschedule(r) : navigate(`admin/inspections/${r.id}`))}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.id}</td>
                    <td className="px-4 py-3 text-slate-700">{r.po?.po_number || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.po?.vendor_name || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{resolveInspectorName(r) || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.item?.item_name ||
                        (r.item?.id || r.purchase_order_item_id
                          ? `Item #${r.item?.id || r.purchase_order_item_id}`
                          : "-")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${resultClass(r)}`}>
                        {displayResult(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.cancel_reason || r.remarks || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.schedule_datetime ? new Date(r.schedule_datetime).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
                          displayStatus(r),
                        )}`}
                      >
                        {displayStatus(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isRescheduleEligible(r) || isCancelEligible(r) ? (
                          <>
                            {isRescheduleEligible(r) && (
                              <button
                                disabled={!canRescheduleInspection}
                                title={!canRescheduleInspection ? "You do not have permission to reschedule." : ""}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReschedule(r);
                                }}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Reschedule
                              </button>
                            )}
                            {isCancelEligible(r) && (
                              <button
                                disabled={!canCancelInspection}
                                title={!canCancelInspection ? "You do not have permission to cancel." : ""}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCancel(r);
                                }}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-medium text-slate-500">--</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                      {rescheduleQueue ? "No inspections pending reschedule" : "No inspections found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionRow && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                {actionType === "cancel" ? "Cancel Inspection Item" : "Reschedule Inspection Item"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {!!actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {actionError}
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {actionRow.po?.po_number || "-"} |{" "}
                {actionRow.item?.item_name ||
                  (actionRow.item?.id || actionRow.purchase_order_item_id
                    ? `Item #${actionRow.item?.id || actionRow.purchase_order_item_id}`
                    : "-")}
              </div>

              {actionType === "reschedule" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Date/Time</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</label>
                <textarea
                  className="mt-1 h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-500"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason required"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
              <button
                disabled={submitting || !reason.trim() || (actionType === "reschedule" && !scheduleDate)}
                onClick={submitAction}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? "Please wait..." : actionType === "cancel" ? "Cancel Item" : "Reschedule Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

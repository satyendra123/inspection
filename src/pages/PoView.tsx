import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams, useSearchParams } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;
const API_ROOT = (API || "").replace(/\/api\/?$/, "");

const getFileUrl = (filePath: string | null | undefined) => {
  if (!filePath) return "#";
  if (/^https?:\/\//i.test(filePath)) return filePath;

  const normalizedPath = String(filePath).replace(/^\/+/, "");
  if (normalizedPath.includes("uploads/")) {
    return `${API_ROOT}/api/${normalizedPath}`;
  }

  return `${API_ROOT}/api/uploads/po/${normalizedPath}`;
};

const getFileList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
    return [trimmed];
  }

  return [];
};

const getFileName = (filePath: string, fallback: string) => {
  const normalized = String(filePath || "").split("?")[0].split("#")[0];
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || fallback;
};

interface Item {
  id: number; // purchase_order_items.id
  po_id: number;
  Item: { item_name: string };
  quantity: number;
}

interface Inspector {
  id: number;
  name: string;
  UserRoles?: { Role?: { role_name?: string } } | any;
}

interface Po {
  id: number;
  po_number: string;
  Vendor: { vendor_name: string } | null;
  Company?: { company_name?: string; name?: string } | null;
  company?: { company_name?: string; name?: string } | null;
  company_name?: string;
  design_reference?: string;
  design_refernce?: string;
  design_ref?: string;
  designRef?: string;
  attachment?: string | null;
  attachments?: string[];
  design_copy?: string | null;
  design_copies?: string[];
  created_by: number;
  createdAt: string;
}

type Assignment = {
  assignment_id?: number;
  inspection_id?: number; // legacy
  item_id: number; // ✅ purchase_order_items.id
  inspector_id: number;
  inspector_name: string;
  schedule_datetime?: string;
  inspection_location?: string;
  remarks?: string;
  status?: string;
};

const PoView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const mode = (searchParams.get("mode") || "view").toLowerCase();
  const isViewMode = mode === "view";
  const isAssignMode = mode === "assign";
  const isEditMode = mode === "edit";

  const token = localStorage.getItem("token") || "";
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  const [po, setPo] = useState<Po | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);

  // ASSIGN mode uses this
  const [selectedInspector, setSelectedInspector] = useState("");

  // EDIT mode: move items FROM one inspector TO another inspector
  const [fromInspector, setFromInspector] = useState("");
  const [toInspector, setToInspector] = useState("");

  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [inspectionLocation, setInspectionLocation] = useState("");
  const [remarks, setRemarks] = useState("");

  // itemId -> assignment
  const [itemAssignmentMap, setItemAssignmentMap] = useState<Record<number, Assignment>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ✅ build assignment map from BOTH formats:
  // 1) res.data.assignments[] (normalized)
  // 2) res.data.po?.InspectionCase?.Assignments[] (nested list)
  const buildAssignmentMap = (resData: any) => {
    const map: Record<number, Assignment> = {};

    // (A) preferred: normalized assignments[]
    const normalized = Array.isArray(resData?.assignments) ? resData.assignments : [];
    if (normalized.length) {
      for (const a of normalized) {
        const itemId = Number(a.item_id);
        if (!itemId) continue;
        map[itemId] = {
          assignment_id: a.assignment_id ? Number(a.assignment_id) : undefined,
          inspection_id: a.inspection_id ? Number(a.inspection_id) : undefined,
          item_id: itemId,
          inspector_id: Number(a.inspector_id),
          inspector_name: a.inspector_name || "-",
          schedule_datetime: a.schedule_datetime || "",
          inspection_location: a.inspection_location || "",
          remarks: a.remarks || "",
          status: a.status || "",
        };
      }
      return map;
    }

    // (B) fallback: nested case format
    const caseRow = resData?.po?.InspectionCase || resData?.InspectionCase;
    const ass = Array.isArray(caseRow?.Assignments) ? caseRow.Assignments : [];

    for (const a of ass) {
      const inspectorName =
        a?.Inspector?.name || a?.Inspector?.email || `Inspector #${a.inspector_id}`;

      const ai = Array.isArray(a?.AssignmentItems) ? a.AssignmentItems : [];
      for (const row of ai) {
        const itemId = Number(row.purchase_order_item_id);
        if (!itemId) continue;

        map[itemId] = {
          assignment_id: a.id ? Number(a.id) : undefined,
          item_id: itemId,
          inspector_id: Number(a.inspector_id),
          inspector_name: inspectorName,
          schedule_datetime: a.scheduled_on || "",
          inspection_location: a.inspection_location || "",
          remarks: a.remarks || "",
          status: a.status || "",
        };
      }
    }

    return map;
  };

  const fetchPoDetail = async () => {
    const res = await axios.get(`${API}/po-view/${id}`, axiosConfig);

    setPo(res.data.po);
    setItems(Array.isArray(res.data.items) ? res.data.items : []);

    const map = buildAssignmentMap(res.data);
    setItemAssignmentMap(map);
  };

  const fetchInspectors = async () => {
    const res = await axios.get(`${API}/admin/users`, axiosConfig);
    const users = Array.isArray(res.data?.users) ? res.data.users : [];

    const getUserRoleName = (u: any): string => {
      if (u?.UserRoles?.Role?.role_name) return u.UserRoles.Role.role_name;
      if (Array.isArray(u?.UserRoles) && u.UserRoles[0]?.Role?.role_name) {
        return u.UserRoles[0].Role.role_name;
      }
      if (u?.UserRoles?.role_name) return u.UserRoles.role_name;
      if (u?.Role?.role_name) return u.Role.role_name;
      if (u?.role?.role_name) return u.role.role_name;
      if (typeof u?.role === "string") return u.role;
      return "";
    };

    const onlyInspectors = users.filter((u: Inspector) => {
      const role = getUserRoleName(u as any);
      return String(role || "").toLowerCase().includes("inspector");
    }).map((u: any) => ({
      ...u,
      name: u.name || u.username || u.email || `User #${u.id}`,
    }));

    // Compatibility fallback:
    // If backend does not send role information, keep dropdown usable.
    const hasAnyRoleInfo = users.some((u: any) =>
      Boolean(
        u?.UserRoles?.Role?.role_name ||
        (Array.isArray(u?.UserRoles) && u.UserRoles[0]?.Role?.role_name) ||
        u?.UserRoles?.role_name ||
        u?.Role?.role_name ||
        u?.role?.role_name ||
        typeof u?.role === "string"
      )
    );

    if (!hasAnyRoleInfo) {
      setInspectors(
        users.map((u: any) => ({
          ...u,
          name: u.name || u.username || u.email || `User #${u.id}`,
        })),
      );
      return;
    }

    setInspectors(onlyInspectors);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPoDetail(), fetchInspectors()])
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inspectorHasAnyAssignment = (inspectorId: number) => {
    return Object.values(itemAssignmentMap).some((a) => Number(a.inspector_id) === inspectorId);
  };

  // ✅ LEFT LIST (NO DESIGN CHANGE)
  const displayItems = useMemo(() => {
    if (isAssignMode) {
      // ASSIGN: only unassigned items
      return items.filter((it) => !itemAssignmentMap[it.id]);
    }

    if (isEditMode) {
      // EDIT: only assigned items
      const assignedOnly = items.filter((it) => !!itemAssignmentMap[it.id]);

      // If fromInspector selected => show only that inspector's assigned items
      if (fromInspector) {
        const fromId = Number(fromInspector);
        return assignedOnly.filter(
          (it) => Number(itemAssignmentMap[it.id]?.inspector_id) === fromId
        );
      }

      // else: show all assigned (so user sees which are assigned)
      return assignedOnly;
    }

    return items;
  }, [items, itemAssignmentMap, isAssignMode, isEditMode, fromInspector]);

  const allSelected = useMemo(
    () => displayItems.length > 0 && selectedItems.length === displayItems.length,
    [displayItems, selectedItems]
  );

  const poAttachments = useMemo(
    () => getFileList(po?.attachments || po?.attachment),
    [po],
  );

  const poDesignCopies = useMemo(
    () => getFileList(po?.design_copies || po?.design_copy),
    [po],
  );

  const toggleSelectAll = () => {
    if (allSelected) setSelectedItems([]);
    else setSelectedItems(displayItems.map((it) => it.id));
  };

  const toggleItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]
    );
  };

  // ✅ EDIT: From inspector => auto-check all his items (then user can uncheck)
  useEffect(() => {
    if (!isEditMode) return;

    if (!fromInspector) {
      setSelectedItems([]);
      setScheduleDateTime("");
      setInspectionLocation("");
      setRemarks("");
      return;
    }

    const fromId = Number(fromInspector);

    const itemIds = Object.entries(itemAssignmentMap)
      .filter(([_, a]) => Number(a.inspector_id) === fromId)
      .map(([itemId]) => Number(itemId));

    setSelectedItems(itemIds);

    const first = itemIds.length ? itemAssignmentMap[itemIds[0]] : undefined;
    if (first) {
      setScheduleDateTime(first.schedule_datetime || "");
      setInspectionLocation(first.inspection_location || "");
      setRemarks(first.remarks || "");
    } else {
      setScheduleDateTime("");
      setInspectionLocation("");
      setRemarks("");
    }
  }, [fromInspector, itemAssignmentMap, isEditMode]);

  const handleSubmit = async () => {
    if (isViewMode) return;

    const finalInspectorId = isEditMode ? toInspector : selectedInspector;

    if (isEditMode) {
      if (!fromInspector) return setError("Please select From Inspector");
      if (!toInspector) return setError("Please select To Inspector");
      if (String(fromInspector) === String(toInspector)) {
        return setError("From Inspector and To Inspector cannot be same");
      }
    }

    if (!finalInspectorId || !scheduleDateTime || !inspectionLocation) {
      setError("Please fill all required fields");
      return;
    }

    if (!selectedItems.length) {
      setError("Please select at least one item");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      // ✅ This API should reassign only selected items (partial move supported)
      const payload = {
        po_id: po?.id,
        inspector_id: finalInspectorId,
        inspection_location: inspectionLocation,
        schedule_datetime: scheduleDateTime,
        remarks,
        item_ids: selectedItems, // purchase_order_items.id
      };

      const res = await axios.post(`${API}/assign-inspector`, payload, axiosConfig);

      if (res.data.status === "success") {
        setMessage(isEditMode ? "Assignment updated successfully" : "Assigned successfully");

        // reset states
        setSelectedItems([]);
        setSelectedInspector("");
        setFromInspector("");
        setToInspector("");
        setScheduleDateTime("");
        setInspectionLocation("");
        setRemarks("");

        await fetchPoDetail();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to assign inspector");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!po) return <div className="p-6 text-red-500">PO not found</div>;

  return (
    <div className="w-full flex gap-6 p-6">
      {/* LEFT */}
      <div className="w-1/2.5 flex flex-col gap-4">
        {!isViewMode && checkPermission("assigninspection_po") && (
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            <span className="font-semibold text-sm">Select All Items</span>
          </div>
        )}

        {displayItems.map((item) => {
          const assign = itemAssignmentMap[item.id];
          const assignedName = assign?.inspector_name || "-";

          return (
            <div
              key={item.id}
              className="bg-green-100 border border-green-300 rounded-xl p-4 flex gap-4"
            >
              {!isViewMode && checkPermission("assigninspection_po") && (
                <div className="items-start pt-2">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => toggleItem(item.id)}
                  />
                </div>
              )}

              <div className="w-28 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full border flex items-center justify-center bg-white">
                  <div className="text-xs text-gray-500">
                    No image <br /> available
                  </div>
                </div>

                <div className="mt-2 text-xs flex gap-2 items-center">
                  <span className="font-bold text-black">
                    {new Date(po.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="font-bold text-black">(By {po.created_by})</span>
                </div>
              </div>

              <div className="flex-1 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">PO ID</span>
                  <span>{po.id}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold">PO Number</span>
                  <span>{po.po_number}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold">Vendor :</span>
                  <span>{po.Vendor?.vendor_name || "Unknown"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold">Company</span>
                  <span>{po.Company?.company_name || po.company?.company_name || po.company_name || "-"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold">Design Ref</span>
                  <span>{po.design_reference || po.design_refernce || po.design_ref || po.designRef || "-"}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold">Item</span>
                  <span className="text-green-700 font-semibold">{item.Item?.item_name}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-semibold">Quantity</span>
                  <span className="text-green-700 font-semibold">{item.quantity}</span>
                </div>

                <div className="flex justify-between mt-2">
                  <span className="font-semibold">Assigned To</span>
                  <span
                    className={
                      assignedName === "-"
                        ? "text-gray-600"
                        : "text-indigo-700 font-semibold"
                    }
                  >
                    {assignedName}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <div className="font-semibold">Soft Copy</div>
                    {poAttachments.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {poAttachments.map((file, fileIndex) => (
                          <a
                            key={`attachment-${fileIndex}`}
                            href={getFileUrl(file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            title={getFileName(file, `Soft Copy ${fileIndex + 1}`)}
                          >
                            {`View ${fileIndex + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No soft copy uploaded</div>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold">Design Copy</div>
                    {poDesignCopies.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {poDesignCopies.map((file, fileIndex) => (
                          <a
                            key={`design-copy-${fileIndex}`}
                            href={getFileUrl(file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            title={getFileName(file, `Design Copy ${fileIndex + 1}`)}
                          >
                            {`View ${fileIndex + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No design copy uploaded</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RIGHT PANEL */}
      {!isViewMode && checkPermission("assigninspection_po") && (
        <div className="bg-white border rounded-xl ml-5 p-6 w-1/2">
          {message && <div className="bg-green-100 text-green-700 p-3 rounded mb-3">{message}</div>}
          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-3">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            {/* Inspector Select */}
            <div>
              <label className="font-semibold mb-1 block">
                {isEditMode ? "From Inspector" : "Assign Inspector"}
              </label>

              <select
                className="border p-2 w-full rounded"
                value={isEditMode ? fromInspector : selectedInspector}
                onChange={(e) => {
                  if (isEditMode) {
                    setFromInspector(e.target.value);
                    setToInspector("");
                  } else {
                    setSelectedInspector(e.target.value);
                  }
                }}
              >
                <option value="">Select Inspector</option>

                {inspectors.map((i) => {
                  const hasAssignment = inspectorHasAnyAssignment(i.id);
                  // EDIT: From Inspector only those who have assignment
                  const disabled = isEditMode ? !hasAssignment : false;

                  return (
                    <option
                      key={i.id}
                      value={i.id}
                      disabled={disabled}
                      style={{
                        color: hasAssignment ? "green" : "black",
                        fontWeight: hasAssignment ? "bold" : "normal",
                      }}
                    >
                      {i.name} {hasAssignment ? "✓" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Right-top cell: To Inspector in edit, Schedule in assign */}
            {isEditMode ? (
              <div>
                <label className="font-semibold mb-1 block">To Inspector</label>
                <select
                  className="border p-2 w-full rounded"
                  value={toInspector}
                  onChange={(e) => setToInspector(e.target.value)}
                  disabled={!fromInspector}
                >
                  <option value="">Select Inspector</option>
                  {inspectors.map((i) => {
                    const hasAssignment = inspectorHasAnyAssignment(i.id);
                    return (
                      <option
                        key={i.id}
                        value={i.id}
                        disabled={Boolean(fromInspector && String(i.id) === String(fromInspector))}
                        style={{
                          color: hasAssignment ? "green" : "black",
                          fontWeight: hasAssignment ? "bold" : "normal",
                        }}
                      >
                        {i.name} {hasAssignment ? "✓" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div>
                <label className="font-semibold mb-1 block">Schedule Date</label>
                <input
                  type="datetime-local"
                  className="border p-2 w-full rounded"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                />
              </div>
            )}

            {/* Schedule Date in EDIT mode to keep layout same */}
            {isEditMode && (
              <div>
                <label className="font-semibold mb-1 block">Schedule Date</label>
                <input
                  type="datetime-local"
                  className="border p-2 w-full rounded"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="font-semibold mb-1 block">Inspection Location</label>
              <input
                type="text"
                className="border p-2 w-full rounded"
                value={inspectionLocation}
                onChange={(e) => setInspectionLocation(e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="font-semibold mb-1 block">Remarks</label>
              <textarea
                className="border p-2 w-full rounded"
                maxLength={50}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              className="border px-6 py-2 rounded"
              onClick={() => {
                setSelectedItems([]);
                setSelectedInspector("");
                setFromInspector("");
                setToInspector("");
                setScheduleDateTime("");
                setInspectionLocation("");
                setRemarks("");
                setError("");
                setMessage("");
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting || selectedItems.length === 0}
              className="bg-indigo-700 text-white px-6 py-2 rounded disabled:opacity-50"
              title={selectedItems.length === 0 ? "Please select at least one item" : "Submit"}
            >
              {submitting ? "Submitting..." : isEditMode ? "Update" : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoView;

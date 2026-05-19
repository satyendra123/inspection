import React, { useEffect, useState } from "react";
import axios from "axios";
import { EditIcon, ViewIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;

const AssignIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h10.5c-.32-.62-.5-1.32-.5-2.06 0-.74.18-1.44.5-2.06H4c.91-1.56 5.06-2.88 8-2.88 1.07 0 2.31.18 3.5.48.31-.67.75-1.27 1.29-1.78C15.14 14.25 13.3 14 12 14Zm7 1v2h2v2h-2v2h-2v-2h-2v-2h2v-2h2Z" />
  </svg>
);

const PoAssign = () => {
  const canAssignInspector = checkPermission("assigninspection_po");
  const canViewPoItems = checkPermission("view_items_po") || checkPermission("viewitems_po");

  const [pos, setPos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token") || "";
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  const fetchPo = async () => {
    try {
      const res = await axios.get(`${API}/po-inspectiolist`, axiosConfig);
      setPos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load PO list");
    }
  };

  useEffect(() => {
    fetchPo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (message || error) {
      const t = setTimeout(() => {
        setMessage("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [message, error]);

  const getStatusBadge = (po: any) => {
    const total = Number(po.total_items || 0);
    const assigned = Number(po.assigned_items || 0);

    if (assigned === 0) return { text: "Not Assigned", cls: "bg-gray-100 text-gray-700" };
    if (total > 0 && assigned < total)
      return { text: `Partially Assigned (${assigned}/${total})`, cls: "bg-yellow-100 text-yellow-800" };
    if (total > 0 && assigned === total)
      return { text: `Assigned (${assigned}/${total})`, cls: "bg-green-100 text-green-700" };

    return { text: "Assigned", cls: "bg-green-100 text-green-700" };
  };

  const filteredPos = pos.filter((po) =>
    JSON.stringify(po).toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="w-full flex flex-col gap-8">
      {message && <div className="bg-green-100 text-green-700 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500">
          <Link to="/assign_inspector">/PO Assign</Link>
        </h1>
      </div>

      <div className="mb-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search PO assign list..."
          className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-3">PO ID</th>
              <th className="p-3">PO Number</th>
              <th className="p-3">Delivery Date</th>
              <th className="p-3">PO Date</th>
              <th className="p-3">Vendor</th>
              <th className="p-3">Assigned Status</th>
              <th className="p-3">Assigned Inspector(s)</th>
              <th className="p-3">Create Date</th>
              {(canAssignInspector || canViewPoItems) && (
                <th className="p-3">Action</th>
              )}
            </tr>
          </thead>

          <tbody>
            {filteredPos.map((po) => {
              const badge = getStatusBadge(po);

              const total = Number(po.total_items || 0);
              const assigned = Number(po.assigned_items || 0);

              const isNotAssigned = assigned === 0;
              const isFullyAssigned = total > 0 && assigned === total;

              return (
                <tr key={po.id} className="border-b">
                  <td className="p-3">{po.id}</td>
                  <td className="p-3">{po.po_number}</td>
                  <td className="p-3">{po.delivery_date}</td>
                  <td className="p-3">{po.po_date}</td>
                  <td className="p-3">{po.Vendor?.vendor_name || "-"}</td>

                  <td className="p-3">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </td>

                  <td className="p-3">{po.assigned_inspectors_text || "-"}</td>
                  <td className="p-3">{po.createdAt}</td>

                  {(canAssignInspector || canViewPoItems) && (
                    <td className="p-3 flex gap-3 items-center">
                      {canViewPoItems && (
                        <Link
                          to={`/po-view/${po.id}?mode=view`}
                          className="text-green-600 hover:text-green-800"
                          title="View"
                        >
                          <ViewIcon />
                        </Link>
                      )}

                      {/* ASSIGN – sirf jab fully assigned nahi hai */}
                      {canAssignInspector && !isFullyAssigned && (
                        <Link
                          to={`/po-view/${po.id}?mode=assign`}
                          className="text-purple-600 hover:text-purple-800"
                          title="Assign Inspector"
                        >
                          <AssignIcon />
                        </Link>
                      )}

                      {/* EDIT – sirf jab kuch assigned ho */}
                      {canAssignInspector && !isNotAssigned && (
                        <Link
                          to={`/po-view/${po.id}?mode=edit`}
                          className="text-blue-500 hover:text-blue-700"
                          title="Edit Assignment"
                        >
                          <EditIcon />
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PoAssign;

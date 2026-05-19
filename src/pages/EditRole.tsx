import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";
const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  headers: { "Content-Type": "application/json" },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const EditRole = () => {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [allAssignedPermissions, setAllAssignedPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<any>(null);

  /* ---------------- FETCH DATA ---------------- */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roleRes, permissionRes] = await Promise.all([
          API.get("/roles"),
          API.get("/permission/all"),
        ]);

        setRoles(roleRes.data?.data || []);
        setPermissions(permissionRes.data?.allpermission || []);
      } catch {
        toast.error("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* -------- FETCH ASSIGNED PERMISSIONS -------- */
  useEffect(() => {
    if (!selectedRoleId) return;

    const fetchAssigned = async () => {
      try {
        const res = await API.get(`/get/assignrole/${selectedRoleId}`);
        setAllAssignedPermissions(res.data?.assigned_permissions || []);
      } catch {
        toast.error("Failed to fetch assigned permissions");
      }
    };

    fetchAssigned();
  }, [selectedRoleId]);

  /* -------- SYNC IDS -------- */
  useEffect(() => {
    setSelectedPermissionIds(allAssignedPermissions.map((p: any) => p.id));
  }, [allAssignedPermissions]);

  /* ---------------- CATEGORY LOGIC ---------------- */
 const getCategory = (key: string) => {
  // Split by underscore and take the part after it (if exists)
  const parts = key.split("_");
  const lastPart = parts.length > 1 ? parts.slice(1).join("_") : key;

  // Map lastPart to category
  if (lastPart.includes("user")) return "User Management";
  if (lastPart.includes("company")) return "Company Management";
  if (lastPart.includes("project")) return "Project Management";
  if (lastPart.includes("role") || lastPart.includes("permission")) return "Role Management";
  if (lastPart.includes("inspection")) return "Inspection Management";
  if (lastPart.includes("dashboard")) return "Dashboard";
  if (lastPart.includes("po")) return "PO Module";
  if ((lastPart.includes("category") || lastPart.includes("item") || lastPart.includes("unit"))) return "Category & Item";
  if (lastPart.includes("vendor")) return "Vendor Management";
  if (lastPart.includes("teststep") || lastPart.includes("teststage")) return "Test Case Management";
  if (lastPart.includes("report")) return "Reports";

  return "Other";
};


  const groupedPermissions = useMemo(() => {
    const grouped: any = {};
    permissions.forEach((perm) => {
      const cat = getCategory(perm.permission_key);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(perm);
    });
    return grouped;
  }, [permissions]);

  /* ---------------- CHECKBOX LOGIC (UNCHANGED) ---------------- */
  const handleCheckboxChange = (id: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(id)
        ? prev.filter((pid) => pid !== id)
        : [...prev, id]
    );
  };

  const toggleCategory = (perms: any[]) => {
    const ids = perms.map((p) => p.id);
    const allChecked = ids.every((id) => selectedPermissionIds.includes(id));

    setSelectedPermissionIds((prev) =>
      allChecked
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async () => {
    if (!selectedRoleId) {
      toast.error("Select a role");
      return;
    }

    if (!selectedPermissionIds.length) {
      toast.error("Select at least one permission");
      return;
    }

    setIsSubmitting(true);
    try {
      await API.put("/update/assignrole", {
        role_id: selectedRoleId,
        permissionIds: selectedPermissionIds,
      });
      toast.success("Role updated successfully");
    } catch {
      toast.error("Failed to update role");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- DELETE ---------------- */
  const handleDeleteRole = async () => {
    if (!selectedRoleId) {
      toast.error("Select a role");
      return;
    }

    setIsDeleting(true);
    try {
      await API.delete(`/delete/assignrole/${selectedRoleId}`);
      toast.success("Role deleted");
      setSelectedRoleId(null);
      setSelectedPermissionIds([]);
    } catch {
      toast.error("Failed to delete role");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold text-blue-500">
        <Link to="/role">Role</Link> {"> "}Edit Role
      </h1>

      <div className="w-full min-w-0 rounded-lg bg-white p-4 shadow sm:p-6 lg:p-8">
        {/* ROLE SELECT */}
        <div className="mb-6">
          <label className="font-semibold mb-2 block">Role Name</label>
          <div className="flex flex-col gap-4 sm:flex-row">
            <select
              value={selectedRoleId ?? ""}
              onChange={(e) => setSelectedRoleId(Number(e.target.value))}
              className="border p-3 rounded w-full"
            >
              <option value="">Select Role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.role_name}
                </option>
              ))}
            </select>

            {checkPermission("delete_assign_role") && (
              <button
                onClick={handleDeleteRole}
                className="bg-red-500 text-white px-6 rounded"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* PERMISSIONS */}
        <h3 className="font-semibold mb-4">
          Set Permissions according to the roles
        </h3>

        {Object.entries(groupedPermissions).map(([cat, perms]: any) => {
          const catChecked = perms.every((p: any) =>
            selectedPermissionIds.includes(p.id)
          );

          return (
            <div key={cat} className="mb-6 border rounded p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={catChecked}
                  onChange={() => toggleCategory(perms)}
                />
                <span className="font-bold">{cat}</span>
              </div>

              <div className="ml-0 grid grid-cols-1 gap-4 sm:ml-6 sm:grid-cols-2">
                {perms.map((perm: any) => (
                  <label key={perm.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissionIds.includes(perm.id)}
                      onChange={() => handleCheckboxChange(perm.id)}
                    />
                    {perm.permission_name}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* SAVE */}
        <div className="flex justify-center mt-6">
          {checkPermission("update_assign_role") && (
            <button
              onClick={handleSubmit}
              className="bg-green-600 text-white px-6 py-3 rounded"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default EditRole;

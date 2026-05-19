import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate, Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;

const CreateRole = () => {
    const [name, setName] = useState("");
    const [permissions, setPermissions] = useState<any[]>([]);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();

    const token = localStorage.getItem("token") || "";
    const axiosConfig = {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    };

    // ------------------------------
    // Fetch permissions
    // ------------------------------
    const fetchPermissions = async () => {
        try {
            const res = await axios.get(`${API}/permission/all`, axiosConfig);
            setPermissions(res.data.allpermission || []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch permissions");
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    // ------------------------------
    // Category mapping based on key
    // ------------------------------
    const getCategory = (key: string) => {
        // take the part after underscore or last part
        const parts = key.split("_");
        const lastPart = parts.length > 1 ? parts.slice(1).join("_") : key;

        if (lastPart.includes("user")) return "User Management";
        if (lastPart.includes("company")) return "Company Management";
        if (lastPart.includes("project")) return "Project Management";
        if (lastPart.includes("role") || lastPart.includes("permission")) return "Role Management";
        if (lastPart.includes("inspection")) return "Inspection Management";
        if (lastPart.includes("dashboard")) return "Dashboard";
        if (lastPart.includes("po")) return "PO Module";
        if (lastPart.includes("category") || lastPart.includes("item") || lastPart.includes("unit")) return "Category & Item";
        if (lastPart.includes("vendor")) return "Vendor Management";
        if (lastPart.includes("teststep") || lastPart.includes("teststage")) return "Test Case Management";
        if (lastPart.includes("report")) return "Report";

        return "Other";
    };

    // ------------------------------
    // Group permissions by category
    // ------------------------------
    const groupedPermissions: Record<string, any[]> = {};
    permissions.forEach((perm) => {
        const category = getCategory(perm.permission_key);
        if (!groupedPermissions[category]) groupedPermissions[category] = [];
        groupedPermissions[category].push(perm);
    });

    // ------------------------------
    // Helpers
    // ------------------------------
    const areAllSelected = (perms: any[]) =>
        perms.every((p) => selectedPermissionIds.includes(p.id));

    const toggleModule = (perms: any[]) => {
        const ids = perms.map((p) => p.id);
        const allSelected = ids.every((id) => selectedPermissionIds.includes(id));
        setSelectedPermissionIds((prev) =>
            allSelected
                ? prev.filter((id) => !ids.includes(id))
                : [...new Set([...prev, ...ids])]
        );
    };

    const togglePermission = (id: number) => {
        setSelectedPermissionIds((prev) =>
            prev.includes(id)
                ? prev.filter((pid) => pid !== id)
                : [...prev, id]
        );
    };

    // ------------------------------
    // Submit
    // ------------------------------
    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error("Please enter role name");
            return;
        }

        if (selectedPermissionIds.length === 0) {
            toast.error("Please select at least one permission");
            return;
        }

        setIsLoading(true);
        try {
            await axios.post(
                `${API}/role/create`,
                { name, permissionIds: selectedPermissionIds },
                axiosConfig
            );

            toast.success("Role created successfully");
            setName("");
            setSelectedPermissionIds([]);
        } catch (error) {
            console.error(error);
            toast.error("Failed to create role");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full overflow-x-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
            <div className="flex w-full flex-col items-start gap-6">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-1">
                    <Link to="/role">
                        <span className="hover:text-blue-800 transition-all duration-300">
                            Role
                        </span>
                    </Link>
                    <span>{">"} Create Role</span>
                </h1>

                {checkPermission("get_assign_role") && (
                    <button
                        onClick={() => navigate("/role/edit-role")}
                        className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
                    >
                        Edit Role
                    </button>
                )}
            </div>

            <div className="w-full min-w-0 rounded-lg bg-white p-4 shadow-md sm:p-6 lg:p-8">
                {/* Role Name */}
                <div className="mb-6">
                    <label className="block text-lg font-semibold mb-2">Role Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 border rounded-lg"
                        disabled={isLoading}
                    />
                </div>

                {/* Permissions */}
                <h3 className="text-lg font-semibold mb-4">
                    Set Permissions according to the roles
                </h3>

                <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <div key={category}>
                            {/* CATEGORY HEADER */}
                            <div className="flex items-center gap-3 font-semibold mb-2">
                                <input
                                    type="checkbox"
                                    checked={areAllSelected(perms)}
                                    onChange={() => toggleModule(perms)}
                                    className="w-5 h-5"
                                />
                                <span>{category}</span>
                            </div>

                            {/* CATEGORY PERMISSIONS */}
                            <div className="ml-0 grid grid-cols-1 gap-3 sm:ml-6 sm:grid-cols-2">
                                {perms.map((perm: any) => (
                                    <label key={perm.id} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedPermissionIds.includes(perm.id)}
                                            onChange={() => togglePermission(perm.id)}
                                            className="w-4 h-4"
                                        />
                                        {perm.permission_name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold"
                    >
                        {isLoading ? "Submitting..." : "Submit"}
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
};

export default CreateRole;

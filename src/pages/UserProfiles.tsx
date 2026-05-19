import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";
import Select from "react-select";
const API = import.meta.env.VITE_API_BASE;

const UserDesk = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  // 🔑 Change password states
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [newUser, setNewUser] = useState<any>({
    id: null,
    name: "",
    username: "",
    password: "",
    email: "",
    gender: "",
    mobile_no: "",
    aadhar_card: "",
    address: "",
    roleName: "",
    companies: [],
    status: "active",
  });

  const token = localStorage.getItem("token") || "";
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, axiosConfig);
      setUsers(Array.isArray(res.data.users) ? res.data.users : []);
    } catch (err) {
      setError("Failed to load users");
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API}/roles`, axiosConfig);
      setRoles(res.data.data || res.data.roles || []);
    } catch (err) {
      setError("Failed to load roles");
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(`${API}/companies`, axiosConfig);
      setCompanies(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError("Failed to load companies");
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (message || error || formError) {
      const t = setTimeout(() => {
        setMessage("");
        setError("");
        setFormError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [message, error, formError]);

  const handleInputChange = (e: any) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (e: any) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  // 🔐 VALIDATION
  const validateForm = () => {
    if (!newUser.name) return "Name is required";
    if (!newUser.username) return "Username is required";
    if (!newUser.email) return "Email is required";
    if (!newUser.mobile_no) return "Mobile number is required";
    if (!newUser.gender) return "Gender is required";
    if (!newUser.roleName) return "Role is required";

    // ADD MODE ONLY
    if (selectedUserIndex === null) {
      if (!newUser.password) return "Password is required";
      if (!confirmPassword) return "Confirm password is required";
      if (newUser.password !== confirmPassword)
        return "Password and Confirm Password do not match";
    }

    return "";
  };

  const handleSaveUser = async () => {
    const validationMsg = validateForm();
    if (validationMsg) {
      setFormError(validationMsg);
      return;
    }

    try {
      const payload = {
        ...newUser,
        company_ids: Array.isArray(newUser.companies)
          ? newUser.companies.map((c: any) => c.value)
          : [],
      };

      if (selectedUserIndex !== null) {
        await axios.put(`${API}/update-user`, payload, axiosConfig);
        setMessage("User updated successfully");
      } else {
        await axios.post(`${API}/create/user`, payload, axiosConfig);
        setMessage("User added successfully");
      }

      fetchUsers();
      closeEditModal();
    } catch (err) {
      setError("Failed to save user");
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (selectedUserIndex === null) {
        setError("No user selected");
        return;
      }
      const userId = users[selectedUserIndex!]?.id;
      await axios.delete(`${API}/delete-user/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessage("User deleted successfully");
      fetchUsers();
      setIsDeleteModalOpen(false);
    } catch (err) {
      setError("Failed to delete user");
    }
  };

  const handleEditUser = (user: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedUserIndex(index);

    setNewUser({
      id: user.id,
      name: user.name || "",
      username: user.username || "",
      password: "",
      email: user.email || "",
      gender: user.gender || "",
      mobile_no: user.mobile_no || "",
      aadhar_card: user.aadhar_card || "",
      address: user.address || "",
      roleName: getUserRoleId(user),
      companies: normalizeUserCompanies(user),
      status: user.status || "active",
    });

    setConfirmPassword("");
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedUserIndex(null);
    setFormError("");
    setConfirmPassword("");
    setNewUser({
      id: null,
      name: "",
      username: "",
      password: "",
      email: "",
      gender: "",
      mobile_no: "",
      aadhar_card: "",
      address: "",
      roleName: "",
      companies: [],
      status: "active",
    });
  };

  const normalizeUserCompanies = (user: any) => {
    const rawCompanies =
      user?.Companies ||
      user?.companies ||
      user?.UserCompanies?.map((uc: any) => uc.Company || uc.company) ||
      [];

    if (!Array.isArray(rawCompanies)) return [];

    return rawCompanies.map((c: any) => ({
      value: c.id,
      label: c.company_name || c.name,
    }));
  };

  const getUserCompanyNames = (user: any) => {
    const rawCompanies =
      user?.Companies ||
      user?.companies ||
      user?.UserCompanies?.map((uc: any) => uc.Company || uc.company) ||
      [];

    if (!Array.isArray(rawCompanies) || rawCompanies.length === 0) {
      return "-";
    }

    return rawCompanies
      .map((c: any) => c.company_name || c.name)
      .filter(Boolean)
      .join(", ");
  };

  const getUserRole = (user: any) => {
    if (user?.UserRoles?.Role) return user.UserRoles.Role;
    if (Array.isArray(user?.UserRoles) && user.UserRoles[0]?.Role) return user.UserRoles[0].Role;
    if (user?.UserRoles && user.UserRoles?.role_name) return user.UserRoles;
    if (user?.Role) return user.Role;
    if (user?.role) return user.role;
    return null;
  };

  const getUserRoleName = (user: any) => {
    const role = getUserRole(user);
    return role?.role_name || role?.name || role?.title || "-";
  };

  const getUserRoleId = (user: any) => {
    const role = getUserRole(user);
    return role?.id || role?.role_id || "";
  };

  const getRoleId = (role: any) => String(role?.id ?? role?.role_id ?? "");
  const getRoleName = (role: any) => role?.role_name || role?.name || role?.title || "Unnamed Role";

  const filteredUsers = users
    .map((user, index) => ({ user, index }))
    .filter(({ user }) =>
      JSON.stringify(user).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  // 🔐 CHANGE PASSWORD
  const handleChangePassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      setFormError("Both password fields required");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setFormError("Passwords do not match");
      return;
    }

    const userId = users[selectedUserIndex!]?.id;

    await axios.put(
      `${API}/admin/forgot-password`,
      { user_id: userId, password: newPassword },
      axiosConfig
    );

    setMessage("Password changed successfully");
    setIsPasswordModalOpen(false);
    setNewPassword("");
    setConfirmNewPassword("");
  };
  return (
    <div className="w-full flex flex-col gap-8 overflow-x-auto">
      {message && <div className="bg-green-100 border text-green-700 p-3 rounded">{message}</div>}
      {(error || formError) && (
        <div className="bg-red-100 border text-red-700 p-3 rounded">
          {error || formError}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500">
          <Link to="/user-desk">/User Desk</Link>
        </h1>
        {checkPermission("add_user") && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Add User
          </button>
        )}
      </div>

      <div className="mb-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search user, role, company..."
          className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
        />
      </div>

      {/* TABLE */}
      <div className="w-full max-w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Name</th>
              <th className="p-3">Username</th>
              <th className="p-3">Email</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Role</th>
              <th className="p-3">Company</th>
              {((checkPermission("change_password_user") ||
                checkPermission("edit_user")) || checkPermission("delete_user")) && (
                  <th className="p-1">Action</th>
                )}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(({ user: u, index }) => (
              <tr key={u.id} className={index % 2 === 0 ? "bg-yellow-50" : ""}>
                <td className="p-3 text-center truncate" title={u.name}>{u.name}</td>
                <td className="p-3 text-center truncate" title={u.username}>{u.username}</td>
                <td className="p-3 text-center truncate" title={u.email}>{u.email}</td>
                <td className="p-3 text-center truncate" title={u.mobile_no}>{u.mobile_no}</td>
                <td className="p-3 text-center truncate" title={u.gender}>{u.gender}</td>
                <td className="p-3 text-center max-w-[180px] truncate" title={getUserRoleName(u)}>
                  {getUserRoleName(u)}
                </td>
                <td className="p-3 text-center max-w-[260px] truncate" title={getUserCompanyNames(u)}>
                  {getUserCompanyNames(u)}
                </td>
                <td className="ml-5 p-3 flex gap-3">
                  {/* 🔑 CHANGE PASSWORD ICON */}
                  {checkPermission("change_password_user") && (
                    <button
                      onClick={() => {
                        setSelectedUserIndex(index);
                        setIsPasswordModalOpen(true);
                      }}
                      title="Change Password"
                    >
                      🔑
                    </button>
                  )}
                  {checkPermission("update_user") && (
                    <button onClick={() => handleEditUser(u, index)}><EditIcon /></button>
                  )}
                  {checkPermission("delete_user") && (
                    <button onClick={() => { setIsDeleteModalOpen(true); setSelectedUserIndex(index); }}>
                      <DeleteIcon />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
              {selectedUserIndex !== null ? "Edit User" : "Add New User"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Fill user details and assign role and companies.
              </p>
            </div>
            {(error || formError) && (
              <div className="mx-6 mt-4 bg-red-100 border text-red-700 p-3 rounded">
                {error || formError}
              </div>
            )}

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      name="name"
                      value={newUser.name}
                      onChange={handleInputChange}
                      placeholder="Enter full name"
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      name="username"
                      value={newUser.username}
                      onChange={handleInputChange}
                      placeholder="Enter username"
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={newUser.email}
                      onChange={handleInputChange}
                      placeholder="Enter email address"
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input
                      name="mobile_no"
                      value={newUser.mobile_no}
                      onChange={handleInputChange}
                      placeholder="Enter mobile number"
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Card</label>
                    <input
                      name="aadhar_card"
                      value={newUser.aadhar_card}
                      onChange={handleInputChange}
                      placeholder="Enter aadhar number"
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      name="gender"
                      value={newUser.gender}
                      onChange={handleInputChange}
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Select Gender</option>
                      <option>male</option>
                      <option>female</option>
                      <option>other</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      name="address"
                      value={newUser.address}
                      onChange={handleInputChange}
                      placeholder="Enter address"
                      className="w-full border p-2.5 rounded-lg min-h-[88px] focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
              </div>

              {/* ADD MODE ONLY */}
              {selectedUserIndex === null && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Password Setup</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        value={newUser.password}
                        onChange={handleInputChange}
                        placeholder="Enter password"
                        className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Access & Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      name="roleName"
                      value={newUser.roleName}
                      onChange={handleInputChange}
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">Select Role</option>
                      {roles.map((r) => (
                        <option key={getRoleId(r)} value={getRoleId(r)}>
                          {getRoleName(r)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      name="status"
                      value={newUser.status}
                      onChange={handleSelectChange}
                      className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block mb-1 text-sm font-medium text-gray-700">Companies</label>
                    <Select
                      isMulti
                      options={companies.map((c) => ({
                        value: c.id,
                        label: c.company_name || c.name,
                      }))}
                      value={newUser.companies}
                      onChange={(selected) =>
                        setNewUser({ ...newUser, companies: selected || [] })
                      }
                      placeholder="Select one or more companies"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-white sticky bottom-0">
              <button onClick={closeEditModal} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleSaveUser} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700">
                {selectedUserIndex !== null ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleDeleteUser} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🔑 CHANGE PASSWORD MODAL */}
      {isPasswordModalOpen && (

        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            {(error || formError) && (
              <div className="bg-red-100 border text-red-700 p-3 rounded">
                {error || formError}
              </div>
            )}
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="border p-2 rounded w-full mb-4"
            />

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsPasswordModalOpen(false)} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleChangePassword} className="bg-green-600 text-white px-4 py-2 rounded">
                Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDesk;

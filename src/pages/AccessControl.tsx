import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import Select from "react-select";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  KeyRound,
  Layers3,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;
const PERMISSION_STORAGE_KEY = "access-control-permissions";

type UserStatus = "active" | "inactive";
type RecordStatus = "Active" | "Inactive";

type SelectOption = {
  value: string;
  label: string;
};

type GroupedSelectOption = {
  label: string;
  options: SelectOption[];
};

type PermissionRecord = {
  id: number;
  permission_name: string;
  permission_key: string;
  description: string;
  status: RecordStatus;
  category: string;
};

type PermissionFormState = {
  id: number | null;
  permission_name: string;
  permission_key: string;
  description: string;
  status: RecordStatus;
};

type UserFormState = {
  id: number | null;
  name: string;
  username: string;
  password: string;
  email: string;
  gender: string;
  mobile_no: string;
  aadhar_card: string;
  address: string;
  roleId: string;
  permissions: SelectOption[];
  companies: SelectOption[];
  status: UserStatus;
};

type StatCardConfig = {
  label: string;
  value: string;
  trend: string;
  direction: "up" | "down";
  icon: LucideIcon;
  iconClass: string;
  tintClass: string;
};

const DEMO_PERMISSIONS_FALLBACK: PermissionRecord[] = [
  {
    id: 1,
    permission_name: "View Users",
    permission_key: "view_user",
    description: "",
    status: "Active",
    category: "User Management",
  },
  {
    id: 2,
    permission_name: "Add User",
    permission_key: "add_user",
    description: "",
    status: "Active",
    category: "User Management",
  },
  {
    id: 3,
    permission_name: "Update User",
    permission_key: "update_user",
    description: "",
    status: "Active",
    category: "User Management",
  },
  {
    id: 4,
    permission_name: "Delete User",
    permission_key: "delete_user",
    description: "",
    status: "Active",
    category: "User Management",
  },
  {
    id: 5,
    permission_name: "View Roles",
    permission_key: "view_role",
    description: "",
    status: "Active",
    category: "Role Management",
  },
  {
    id: 6,
    permission_name: "Create Role",
    permission_key: "create_role",
    description: "",
    status: "Active",
    category: "Role Management",
  },
  {
    id: 7,
    permission_name: "View Permissions",
    permission_key: "view_permission",
    description: "",
    status: "Active",
    category: "Role Management",
  },
  {
    id: 8,
    permission_name: "Create Permission",
    permission_key: "create_permission",
    description: "",
    status: "Active",
    category: "Role Management",
  },
];

const USER_STATS_BASE: Omit<StatCardConfig, "value">[] = [
  {
    label: "Total Users",
    trend: "12.4% from last month",
    direction: "up",
    icon: Users,
    iconClass: "text-violet-600",
    tintClass: "bg-violet-100",
  },
  {
    label: "Active Users",
    trend: "8.2% from last month",
    direction: "up",
    icon: BadgeCheck,
    iconClass: "text-emerald-600",
    tintClass: "bg-emerald-100",
  },
  {
    label: "Roles",
    trend: "4.6% from last month",
    direction: "up",
    icon: ShieldCheck,
    iconClass: "text-blue-600",
    tintClass: "bg-blue-100",
  },
  {
    label: "Permissions",
    trend: "7.8% from last month",
    direction: "up",
    icon: KeyRound,
    iconClass: "text-amber-600",
    tintClass: "bg-amber-100",
  },
];

const ROLE_STATS_BASE: Omit<StatCardConfig, "value">[] = [
  {
    label: "Total Roles",
    trend: "2.9% from last month",
    direction: "up",
    icon: ShieldCheck,
    iconClass: "text-violet-600",
    tintClass: "bg-violet-100",
  },
  {
    label: "Permission Groups",
    trend: "All categories available",
    direction: "up",
    icon: Layers3,
    iconClass: "text-blue-600",
    tintClass: "bg-blue-100",
  },
  {
    label: "Assigned Users",
    trend: "Based on current roles",
    direction: "up",
    icon: Users,
    iconClass: "text-emerald-600",
    tintClass: "bg-emerald-100",
  },
  {
    label: "Role Draft",
    trend: "Ready to create",
    direction: "up",
    icon: UserRound,
    iconClass: "text-amber-600",
    tintClass: "bg-amber-100",
  },
];

const PERMISSION_STATS_BASE: Omit<StatCardConfig, "value">[] = [
  {
    label: "Total Permissions",
    trend: "12.5% from last month",
    direction: "up",
    icon: KeyRound,
    iconClass: "text-violet-600",
    tintClass: "bg-violet-100",
  },
  {
    label: "Active",
    trend: "Permissions in use",
    direction: "up",
    icon: BadgeCheck,
    iconClass: "text-emerald-600",
    tintClass: "bg-emerald-100",
  },
  {
    label: "Inactive",
    trend: "Hidden / disabled",
    direction: "down",
    icon: ShieldCheck,
    iconClass: "text-rose-600",
    tintClass: "bg-rose-100",
  },
  {
    label: "Categories",
    trend: "Grouped by module",
    direction: "up",
    icon: Layers3,
    iconClass: "text-blue-600",
    tintClass: "bg-blue-100",
  },
];

const STATUS_STYLES: Record<RecordStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  Inactive: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
};

const USER_STATUS_STYLES: Record<UserStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  inactive: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
};

const TAB_ROUTES = {
  users: "/user",
  roles: "/role",
  permissions: "/permission",
} as const;

function getPermissionCategory(key: string) {
  const parts = key.split("_");
  const tail = parts.length > 1 ? parts.slice(1).join("_") : key;

  if (tail.includes("user")) return "User Management";
  if (tail.includes("company")) return "Company Management";
  if (tail.includes("project")) return "Project Management";
  if (tail.includes("role") || tail.includes("permission")) return "Role Management";
  if (tail.includes("inspection")) return "Inspection Management";
  if (tail.includes("dashboard")) return "Dashboard";
  if (tail.includes("po")) return "PO Module";
  if (tail.includes("category") || tail.includes("item") || tail.includes("unit")) return "Category & Item";
  if (tail.includes("vendor")) return "Vendor Management";
  if (tail.includes("teststep") || tail.includes("teststage")) return "Test Case Management";
  if (tail.includes("report")) return "Report";

  return "Other";
}

function normalizePermission(raw: any, fallbackId: number): PermissionRecord {
  const permissionKey = raw?.permission_key || raw?.key || raw?.name || `permission_${fallbackId}`;
  return {
    id: Number(raw?.id ?? raw?.permission_id ?? fallbackId),
    permission_name: raw?.permission_name || raw?.name || raw?.title || "Unnamed Permission",
    permission_key: permissionKey,
    description: raw?.description || "",
    status: String(raw?.status || "Active").toLowerCase() === "inactive" ? "Inactive" : "Active",
    category: raw?.category || getPermissionCategory(permissionKey),
  };
}

function toOption(value: string | number, label: string): SelectOption {
  return { value: String(value), label };
}

function getRoleName(role: any) {
  return role?.role_name || role?.name || role?.title || "Unnamed Role";
}

function getRoleId(role: any) {
  return String(role?.id ?? role?.role_id ?? "");
}

function getUserRole(user: any) {
  if (user?.UserRoles?.Role) return user.UserRoles.Role;
  if (Array.isArray(user?.UserRoles) && user.UserRoles[0]?.Role) return user.UserRoles[0].Role;
  if (user?.UserRoles && user.UserRoles?.role_name) return user.UserRoles;
  if (user?.Role) return user.Role;
  if (user?.role) return user.role;
  return null;
}

function getUserRoleName(user: any) {
  const role = getUserRole(user);
  return role?.role_name || role?.name || role?.title || "-";
}

function getUserRoleId(user: any) {
  const role = getUserRole(user);
  return role?.id || role?.role_id || "";
}

function getUserCompanyNames(user: any) {
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
}

function getUserPermissionIds(user: any) {
  const raw =
    user?.permissions ||
    user?.Permissions ||
    user?.UserPermissions ||
    user?.assigned_permissions ||
    [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map((permission: any) =>
      Number(permission?.id ?? permission?.permission_id ?? permission?.Permission?.id ?? permission?.permission?.id),
    )
    .filter((id: number) => Number.isFinite(id) && id > 0);
}

function buildGroupedPermissionOptions(permissions: PermissionRecord[]): GroupedSelectOption[] {
  const groups: Record<string, SelectOption[]> = {};

  permissions.forEach((permission) => {
    const category = permission.category || getPermissionCategory(permission.permission_key);
    if (!groups[category]) groups[category] = [];
    groups[category].push(toOption(permission.id, permission.permission_name));
  });

  return Object.entries(groups).map(([label, options]) => ({ label, options }));
}

function resolveTab(pathname: string) {
  if (pathname.startsWith("/permission")) return "permissions";
  if (pathname.startsWith("/role")) return "roles";
  return "users";
}

function StatCard({ label, value, trend, direction, icon: Icon, iconClass, tintClass }: StatCardConfig) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${tintClass}`}>
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="whitespace-nowrap text-[11px] font-medium leading-none text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-semibold leading-none tracking-tight text-slate-900">{value}</p>
          <div className="mt-2 flex w-full items-center justify-start gap-1.5 text-left text-[10px] font-medium leading-tight">
            {direction === "up" ? (
              <TrendingUp className="h-3.5 w-3.5 flex-none text-emerald-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 flex-none text-rose-500" />
            )}
            <span className={`min-w-0 whitespace-nowrap ${direction === "up" ? "text-emerald-600" : "text-rose-600"}`}>
              {trend}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: RecordStatus | UserStatus }) {
  const isUserStatus = status === "active" || status === "inactive";
  const classes = isUserStatus ? USER_STATUS_STYLES[status] : STATUS_STYLES[status as RecordStatus];
  const label = isUserStatus ? (status === "active" ? "Active" : "Inactive") : status;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-lg",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/20 backdrop-blur-[2px]">
      <button type="button" aria-label="Close overlay" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="absolute left-4 right-4 top-24 z-10 mx-auto w-full lg:left-[19rem] lg:right-auto lg:mx-0 lg:w-[calc(100vw-21rem)]">
        <div className={`w-full ${widthClass} rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.25)]`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-slate-900">{title}</h4>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close popup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-violet-600 text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)]"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/15" : "bg-white text-slate-500"}`}>
        {count}
      </span>
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  actionLabel,
  onAction,
  secondaryAction,
}: {
  title: string;
  subtitle: string;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  actionLabel: string;
  onAction: () => void;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
          />
        </div>
        <div className="flex items-center gap-2">
          {secondaryAction}
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function emptyUserForm(): UserFormState {
  return {
    id: null,
    name: "",
    username: "",
    password: "",
    email: "",
    gender: "",
    mobile_no: "",
    aadhar_card: "",
    address: "",
    roleId: "",
    permissions: [],
    companies: [],
    status: "active",
  };
}

function emptyPermissionForm(): PermissionFormState {
  return {
    id: null,
    permission_name: "",
    permission_key: "",
    description: "",
    status: "Active",
  };
}

const readStoredPermissions = (): PermissionRecord[] => {
  try {
    const raw = localStorage.getItem(PERMISSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const AccessControl = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = resolveTab(location.pathname);
  const canAddUser = checkPermission("add_user") || checkPermission("create_user");
  const canUpdateUser = checkPermission("update_user") || checkPermission("edit_user");
  const canDeleteUser = checkPermission("delete_user");
  const canChangePassword = checkPermission("change_password_user");
  const canCreateRole = checkPermission("create_role");
  const canViewPermission = checkPermission("view_permission") || checkPermission("create_permission");
  const canCreatePermission = checkPermission("create_permission");
  const canEditPermission = checkPermission("update_permission");
  const canDeletePermission = checkPermission("delete_permission");

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>(readStoredPermissions());

  const [userSearch, setUserSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userDeleteOpen, setUserDeleteOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);

  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm());
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [roleName, setRoleName] = useState("");
  const [selectedRolePermissionIds, setSelectedRolePermissionIds] = useState<number[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);

  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionForm, setPermissionForm] = useState<PermissionFormState>(emptyPermissionForm());

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const token = localStorage.getItem("token") || "";
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  useEffect(() => {
    if (message || error || formError) {
      const timeout = window.setTimeout(() => {
        setMessage("");
        setError("");
        setFormError("");
      }, 3000);

      return () => window.clearTimeout(timeout);
    }
  }, [message, error, formError]);

  useEffect(() => {
    localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify(permissions));
  }, [permissions]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API}/admin/users`, axiosConfig);
        setUsers(Array.isArray(res.data.users) ? res.data.users : []);
      } catch {
        setError("Failed to load users");
      }
    };

    const fetchRoles = async () => {
      try {
        const res = await axios.get(`${API}/roles`, axiosConfig);
        const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data?.roles) ? res.data.roles : [];
        setRoles(data);
      } catch {
        setError("Failed to load roles");
      }
    };

    const fetchCompanies = async () => {
      try {
        const res = await axios.get(`${API}/companies`, axiosConfig);
        setCompanies(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        setError("Failed to load companies");
      }
    };

    const fetchPermissions = async () => {
      try {
        const res = await axios.get(`${API}/permission/all`, axiosConfig);
        const remote = Array.isArray(res.data?.allpermission) ? res.data.allpermission : [];
        const normalizedRemote = remote.map((perm: any, index: number) => normalizePermission(perm, index + 1));

        setPermissions((current) => {
          const merged = [...normalizedRemote];
          current.forEach((perm) => {
            if (!merged.some((item) => item.id === perm.id)) {
              merged.push(perm);
            }
          });
          return merged;
        });
      } catch {
        if (permissions.length === 0) {
          setPermissions(DEMO_PERMISSIONS_FALLBACK);
        }
      }
    };

    fetchUsers();
    fetchRoles();
    fetchCompanies();
    fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permissionGroups = useMemo(() => buildGroupedPermissionOptions(permissions), [permissions]);
  const permissionOptions = useMemo(() => permissions.map((permission) => toOption(permission.id, permission.permission_name)), [permissions]);
  const companyOptions = useMemo(
    () => companies.map((company) => toOption(company.id, company.company_name || company.name || "Unnamed Company")),
    [companies],
  );

  const filteredUsers = useMemo(
    () =>
      users
        .map((user, index) => ({ user, index }))
        .filter(({ user }) => JSON.stringify(user).toLowerCase().includes(userSearch.toLowerCase())),
    [userSearch, users],
  );

  const filteredRoles = useMemo(
    () =>
      roles
        .map((role, index) => ({ role, index }))
        .filter(({ role }) => JSON.stringify(role).toLowerCase().includes(roleSearch.toLowerCase())),
    [roleSearch, roles],
  );

  const filteredPermissions = useMemo(
    () =>
      permissions
        .map((permission, index) => ({ permission, index }))
        .filter(({ permission }) =>
          `${permission.permission_name} ${permission.permission_key} ${permission.category} ${permission.status}`
            .toLowerCase()
            .includes(permissionSearch.toLowerCase()),
        ),
    [permissionSearch, permissions],
  );

  const userStats = [
    users.length.toLocaleString(),
    users.filter((user) => String(user?.status || "active").toLowerCase() === "active").length.toLocaleString(),
    roles.length.toLocaleString(),
    permissions.length.toLocaleString(),
  ];

  const roleStats = [
    roles.length.toLocaleString(),
    new Set(permissions.map((permission) => permission.category)).size.toLocaleString(),
    users.filter((user) => getUserRoleId(user)).length.toLocaleString(),
    roleName.trim() ? "1" : "0",
  ];

  const permissionStats = [
    permissions.length.toLocaleString(),
    permissions.filter((permission) => permission.status === "Active").length.toLocaleString(),
    permissions.filter((permission) => permission.status === "Inactive").length.toLocaleString(),
    new Set(permissions.map((permission) => permission.category)).size.toLocaleString(),
  ];

  const openAddUser = () => {
    setSelectedUserIndex(null);
    setUserForm(emptyUserForm());
    setConfirmPassword("");
    setUserModalOpen(true);
  };

  const openEditUser = (user: any, index: number) => {
    setSelectedUserIndex(index);
    setUserForm({
      id: user.id,
      name: user.name || "",
      username: user.username || "",
      password: "",
      email: user.email || "",
      gender: user.gender || "",
      mobile_no: user.mobile_no || "",
      aadhar_card: user.aadhar_card || "",
      address: user.address || "",
      roleId: String(getUserRoleId(user) || ""),
      permissions: permissionOptions.filter((option) => getUserPermissionIds(user).includes(Number(option.value))),
      companies: Array.isArray(user?.Companies || user?.companies)
        ? (user?.Companies || user?.companies).map((company: any) =>
            toOption(company.id, company.company_name || company.name || "Unnamed Company"),
          )
        : [],
      status: String(user?.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    });
    setConfirmPassword("");
    setUserModalOpen(true);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    setSelectedUserIndex(null);
    setUserForm(emptyUserForm());
    setConfirmPassword("");
    setFormError("");
  };

  const validateUserForm = () => {
    if (!userForm.name.trim()) return "Name is required";
    if (!userForm.username.trim()) return "Username is required";
    if (!userForm.email.trim()) return "Email is required";
    if (!userForm.mobile_no.trim()) return "Mobile number is required";
    if (!userForm.gender.trim()) return "Gender is required";
    if (!userForm.roleId.trim()) return "Role is required";

    if (selectedUserIndex === null) {
      if (!userForm.password.trim()) return "Password is required";
      if (!confirmPassword) return "Confirm password is required";
      if (userForm.password !== confirmPassword) return "Password and confirm password do not match";
    }

    return "";
  };

  const handleSaveUser = async () => {
    const validation = validateUserForm();
    if (validation) {
      setFormError(validation);
      return;
    }

    try {
      const payload = {
        ...userForm,
        roleName: userForm.roleId,
        role_id: userForm.roleId,
        permissionIds: userForm.permissions.map((permission) => Number(permission.value)),
        permission_ids: userForm.permissions.map((permission) => Number(permission.value)),
        company_ids: userForm.companies.map((company) => Number(company.value)),
      };

      if (selectedUserIndex !== null) {
        await axios.put(`${API}/update-user`, payload, axiosConfig);
        setMessage("User updated successfully");
      } else {
        await axios.post(`${API}/create/user`, payload, axiosConfig);
        setMessage("User added successfully");
      }

      const res = await axios.get(`${API}/admin/users`, axiosConfig);
      setUsers(Array.isArray(res.data.users) ? res.data.users : []);
      closeUserModal();
    } catch {
      setError("Failed to save user");
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (selectedUserIndex === null) {
        setError("Select a user first");
        return;
      }

      const userId = users[selectedUserIndex]?.id;
      await axios.delete(`${API}/delete-user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage("User deleted successfully");
      const res = await axios.get(`${API}/admin/users`, axiosConfig);
      setUsers(Array.isArray(res.data.users) ? res.data.users : []);
      setUserDeleteOpen(false);
      setSelectedUserIndex(null);
    } catch {
      setError("Failed to delete user");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setFormError("Both password fields are required");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setFormError("Passwords do not match");
      return;
    }

    try {
      if (selectedUserIndex === null) return;
      const userId = users[selectedUserIndex]?.id;
      await axios.put(
        `${API}/admin/forgot-password`,
        { user_id: userId, password: newPassword },
        axiosConfig,
      );
      setMessage("Password changed successfully");
      setPasswordModalOpen(false);
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setError("Failed to change password");
    }
  };

  const openAddPermission = () => {
    setPermissionForm(emptyPermissionForm());
    setPermissionModalOpen(true);
  };

  const openEditPermission = (permission: PermissionRecord) => {
    setPermissionForm({
      id: permission.id,
      permission_name: permission.permission_name,
      permission_key: permission.permission_key,
      description: permission.description,
      status: permission.status,
    });
    setPermissionModalOpen(true);
  };

  const closePermissionModal = () => {
    setPermissionModalOpen(false);
    setPermissionForm(emptyPermissionForm());
  };

  const savePermission = () => {
    const name = permissionForm.permission_name.trim();
    const key = permissionForm.permission_key.trim();

    if (!name || !key) {
      setFormError("Permission name and key are required");
      return;
    }

    const nextPermission: PermissionRecord = {
      id:
        permissionForm.id ??
        Math.max(0, ...permissions.map((permission) => permission.id)) + 1,
      permission_name: name,
      permission_key: key,
      description: permissionForm.description.trim(),
      status: permissionForm.status,
      category: getPermissionCategory(key),
    };

    setPermissions((current) => {
      if (permissionForm.id === null) {
        return [nextPermission, ...current];
      }

      return current.map((permission) => (permission.id === permissionForm.id ? nextPermission : permission));
    });

    setMessage(permissionForm.id === null ? "Permission added successfully" : "Permission updated successfully");
    closePermissionModal();
  };

  const deletePermission = (permissionId: number) => {
    const confirmed = window.confirm("Delete this permission?");
    if (!confirmed) return;

    setPermissions((current) => current.filter((permission) => permission.id !== permissionId));
    setMessage("Permission deleted successfully");
  };

  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      setFormError("Role name is required");
      return;
    }

    if (selectedRolePermissionIds.length === 0) {
      setFormError("Select at least one permission");
      return;
    }

    setRoleSaving(true);
    try {
      await axios.post(
        `${API}/role/create`,
        { name: roleName.trim(), permissionIds: selectedRolePermissionIds },
        axiosConfig,
      );
      setMessage("Role created successfully");
      setRoleName("");
      setSelectedRolePermissionIds([]);
      const res = await axios.get(`${API}/roles`, axiosConfig);
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data?.roles) ? res.data.roles : [];
      setRoles(data);
    } catch {
      setError("Failed to create role");
    } finally {
      setRoleSaving(false);
    }
  };

  const userTabStats = USER_STATS_BASE.map((stat, index) => ({ ...stat, value: userStats[index] ?? "0" }));
  const roleTabStats = ROLE_STATS_BASE.map((stat, index) => ({ ...stat, value: roleStats[index] ?? "0" }));
  const permissionTabStats = PERMISSION_STATS_BASE.map((stat, index) => ({ ...stat, value: permissionStats[index] ?? "0" }));

  const userFilteredCount = filteredUsers.length;
  const roleFilteredCount = filteredRoles.length;
  const permissionFilteredCount = filteredPermissions.length;

  return (
    <div className="space-y-6">
      {(message || error || formError) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error || formError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || formError || message}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Access Control</h2>
            <p className="text-sm text-slate-500">Manage users, roles, and permissions from one place.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabButton
              active={activeTab === "users"}
              label="Users"
              count={users.length}
              onClick={() => navigate(TAB_ROUTES.users)}
            />
            <TabButton
              active={activeTab === "roles"}
              label="Roles"
              count={roles.length}
              onClick={() => navigate(TAB_ROUTES.roles)}
            />
            <TabButton
              active={activeTab === "permissions"}
              label="Permissions"
              count={permissions.length}
              onClick={() =>
                canViewPermission ? navigate(TAB_ROUTES.permissions) : setError("You do not have permission to view permissions")
              }
            />
          </div>
        </div>

        {activeTab === "users" && (
          <div className="space-y-6 p-5">
            <section className="grid gap-4 xl:grid-cols-4">
              {userTabStats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
              <SectionHeader
                title="Users"
                subtitle="View, add, edit and delete users. Roles and permissions are assigned here."
                searchValue={userSearch}
                searchPlaceholder="Search users..."
                onSearchChange={setUserSearch}
                actionLabel="Add User"
                onAction={canAddUser ? openAddUser : () => setError("You do not have permission to add users")}
              />

              <div className="px-5 pb-5 pt-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[1050px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Mobile</th>
                        <th className="px-4 py-3">Gender</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Companies</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(({ user, index }) => (
                        <tr key={user.id} className="border-t border-slate-100 text-sm text-slate-700">
                          <td className="px-4 py-4 font-semibold text-slate-900">{user.name}</td>
                          <td className="px-4 py-4">{user.username}</td>
                          <td className="px-4 py-4">{user.email}</td>
                          <td className="px-4 py-4">{user.mobile_no}</td>
                          <td className="px-4 py-4">{user.gender}</td>
                          <td className="px-4 py-4">{getUserRoleName(user)}</td>
                          <td className="px-4 py-4">{getUserCompanyNames(user)}</td>
                          <td className="px-4 py-4">
                            <StatusBadge status={String(user?.status || "active").toLowerCase() === "inactive" ? "inactive" : "active"} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {canChangePassword && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserIndex(index);
                                    setPasswordModalOpen(true);
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                  aria-label="Change password"
                                  title="Change password"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>
                              )}
                              {canUpdateUser && (
                                <button
                                  type="button"
                                  onClick={() => openEditUser(user, index)}
                                  className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                  aria-label="Edit user"
                                >
                                  <PencilLine className="h-4 w-4" />
                                </button>
                              )}
                              {canDeleteUser && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserIndex(index);
                                    setUserDeleteOpen(true);
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-full text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                                  aria-label="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  Showing {userFilteredCount} users
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="space-y-6 p-5">
            <section className="grid gap-4 xl:grid-cols-4">
              {roleTabStats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                <div className="border-b border-slate-100 px-5 py-5">
                  <h3 className="text-xl font-bold text-slate-900">Create Role</h3>
                  <p className="text-sm text-slate-500">Add a new role and map permissions to it.</p>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Role Name *</label>
                    <input
                      type="text"
                      value={roleName}
                      onChange={(event) => setRoleName(event.target.value)}
                      placeholder="Enter role name"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Permissions *</label>
                    <Select
                      isMulti
                      options={permissionGroups}
                      value={permissionOptions.filter((option) =>
                        selectedRolePermissionIds.includes(Number(option.value)),
                      )}
                      onChange={(selected: any) =>
                        setSelectedRolePermissionIds(
                          Array.isArray(selected) ? selected.map((option: any) => Number(option.value)) : [],
                        )
                      }
                      placeholder="Select permissions"
                      classNamePrefix="react-select"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="text-sm text-slate-500">
                      {selectedRolePermissionIds.length} permission(s) selected
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateRole}
                      disabled={roleSaving || !canCreateRole}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Plus className="h-4 w-4" />
                      {roleSaving ? "Saving..." : "Save Role"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                <SectionHeader
                  title="Existing Roles"
                  subtitle="Current roles loaded from the backend."
                  searchValue={roleSearch}
                  searchPlaceholder="Search roles..."
                  onSearchChange={setRoleSearch}
                  actionLabel="Refresh"
                  onAction={async () => {
                    try {
                      const res = await axios.get(`${API}/roles`, axiosConfig);
                      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data?.roles) ? res.data.roles : [];
                      setRoles(data);
                      setMessage("Roles refreshed");
                    } catch {
                      setError("Failed to refresh roles");
                    }
                  }}
                />

                <div className="px-5 pb-5 pt-4">
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full min-w-[500px] border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Permission Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoles.map(({ role }) => {
                          const permissionCount = Array.isArray(role?.permissions)
                            ? role.permissions.length
                            : Array.isArray(role?.Permission)
                              ? role.Permission.length
                              : Array.isArray(role?.permissions_data)
                                ? role.permissions_data.length
                                : 0;

                          return (
                            <tr key={getRoleId(role)} className="border-t border-slate-100 text-sm text-slate-700">
                              <td className="px-4 py-4 font-semibold text-slate-900">{getRoleName(role)}</td>
                              <td className="px-4 py-4">{permissionCount}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-sm text-slate-500">
                    Showing {roleFilteredCount} roles
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "permissions" && (
          <div className="space-y-6 p-5">
            <section className="grid gap-4 xl:grid-cols-4">
              {permissionTabStats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
                <SectionHeader
                  title="Permissions"
                  subtitle="Add, edit, and delete module permissions."
                  searchValue={permissionSearch}
                  searchPlaceholder="Search permissions..."
                  onSearchChange={setPermissionSearch}
                  actionLabel="Add Permission"
                  onAction={
                    canCreatePermission
                      ? openAddPermission
                      : () => setError("You do not have permission to add permissions")
                  }
                />

              <div className="px-5 pb-5 pt-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[860px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Permission Name</th>
                        <th className="px-4 py-3">Permission Key</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPermissions.map(({ permission }) => (
                        <tr key={permission.id} className="border-t border-slate-100 text-sm text-slate-700">
                          <td className="px-4 py-4 font-semibold text-slate-900">{permission.permission_name}</td>
                          <td className="px-4 py-4 text-slate-500">{permission.permission_key}</td>
                          <td className="px-4 py-4">{permission.category}</td>
                          <td className="px-4 py-4">
                            <StatusBadge status={permission.status} />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {canEditPermission && (
                                <button
                                  type="button"
                                  onClick={() => openEditPermission(permission)}
                                  className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                  aria-label="Edit permission"
                                >
                                  <PencilLine className="h-4 w-4" />
                                </button>
                              )}
                              {canDeletePermission && (
                                <button
                                  type="button"
                                  onClick={() => deletePermission(permission.id)}
                                  className="grid h-8 w-8 place-items-center rounded-full text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                                  aria-label="Delete permission"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  Showing {permissionFilteredCount} permissions
                </div>
              </div>
            </section>
          </div>
        )}
      </section>

      {userModalOpen && (
        <ModalShell
          title={selectedUserIndex !== null ? "Edit User" : "Add New User"}
          subtitle="Fill user details and assign role and permissions."
          onClose={closeUserModal}
          widthClass="max-w-4xl"
        >
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Basic Information</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    value={userForm.name}
                    onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Enter full name"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                  <input
                    value={userForm.username}
                    onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="Enter username"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Enter email address"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
                  <input
                    value={userForm.mobile_no}
                    onChange={(event) => setUserForm((current) => ({ ...current, mobile_no: event.target.value }))}
                    placeholder="Enter mobile number"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Aadhar Card</label>
                  <input
                    value={userForm.aadhar_card}
                    onChange={(event) => setUserForm((current) => ({ ...current, aadhar_card: event.target.value }))}
                    placeholder="Enter aadhar number"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
                  <select
                    value={userForm.gender}
                    onChange={(event) => setUserForm((current) => ({ ...current, gender: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-400"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                  <textarea
                    value={userForm.address}
                    onChange={(event) => setUserForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Enter address"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                  />
                </div>
              </div>
            </div>

            {selectedUserIndex === null && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Password Setup</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder="Enter password"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter password"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Access & Assignment</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                  <select
                    value={userForm.roleId}
                    onChange={(event) => setUserForm((current) => ({ ...current, roleId: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-400"
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={getRoleId(role)} value={getRoleId(role)}>
                        {getRoleName(role)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={userForm.status}
                    onChange={(event) =>
                      setUserForm((current) => ({ ...current, status: event.target.value as UserStatus }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-400"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Permissions</label>
                  <Select
                    isMulti
                    options={permissionGroups}
                    value={userForm.permissions}
                    onChange={(selected: any) =>
                      setUserForm((current) => ({ ...current, permissions: Array.isArray(selected) ? selected : [] }))
                    }
                    placeholder="Select permissions"
                    classNamePrefix="react-select"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Companies</label>
                  <Select
                    isMulti
                    options={companyOptions}
                    value={userForm.companies}
                    onChange={(selected: any) =>
                      setUserForm((current) => ({ ...current, companies: Array.isArray(selected) ? selected : [] }))
                    }
                    placeholder="Select one or more companies"
                    classNamePrefix="react-select"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={closeUserModal}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveUser}
              className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition hover:brightness-110"
            >
              {selectedUserIndex !== null ? "Update User" : "Save User"}
            </button>
          </div>
        </ModalShell>
      )}

      {userDeleteOpen && (
        <ModalShell title="Confirm Delete" subtitle="This will remove the selected user." onClose={() => setUserDeleteOpen(false)} widthClass="max-w-md">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setUserDeleteOpen(false)}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        </ModalShell>
      )}

      {passwordModalOpen && (
        <ModalShell title="Change Password" subtitle="Update the selected user's password." onClose={() => setPasswordModalOpen(false)} widthClass="max-w-md">
          <div className="space-y-4">
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Change
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {permissionModalOpen && (
        <ModalShell
          title={permissionForm.id === null ? "Add Permission" : "Edit Permission"}
          subtitle="Create or update a permission entry."
          onClose={closePermissionModal}
          widthClass="max-w-lg"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Permission Name *</label>
              <input
                value={permissionForm.permission_name}
                onChange={(event) => setPermissionForm((current) => ({ ...current, permission_name: event.target.value }))}
                placeholder="Enter permission name"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Permission Key *</label>
              <input
                value={permissionForm.permission_key}
                onChange={(event) => setPermissionForm((current) => ({ ...current, permission_key: event.target.value }))}
                placeholder="e.g. create_user"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={permissionForm.description}
                onChange={(event) => setPermissionForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Enter description"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={permissionForm.status}
                onChange={(event) =>
                  setPermissionForm((current) => ({ ...current, status: event.target.value as RecordStatus }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-400"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closePermissionModal}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePermission}
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition hover:brightness-110"
              >
                {permissionForm.id === null ? "Save Permission" : "Update Permission"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export default AccessControl;

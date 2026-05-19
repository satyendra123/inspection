import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import NotificationDropdown from "../components/header/NotificationDropdown";

type HeaderMeta = {
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  showShortcut?: boolean;
};

const HEADER_META: Record<string, HeaderMeta> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your assets",
  },
  company: {
    title: "Company Setup",
    subtitle: "Manage company details and branding",
  },
  project: {
    title: "Projects",
    subtitle: "Manage projects linked to companies",
  },
  user: {
    title: "Access Control",
    subtitle: "Users, roles and permissions",
    searchPlaceholder: "Search users, roles, permissions...",
  },
  role: {
    title: "Access Control",
    subtitle: "Users, roles and permissions",
    searchPlaceholder: "Search users, roles, permissions...",
  },
  permission: {
    title: "Access Control",
    subtitle: "Users, roles and permissions",
    searchPlaceholder: "Search users, roles, permissions...",
  },
  categories: {
    title: "Category & Items",
    subtitle: "Home > Masters > Category & Items",
    searchPlaceholder: "Search categories or items...",
    showShortcut: false,
  },
  items: {
    title: "Category & Items",
    subtitle: "Home > Masters > Category & Items",
    searchPlaceholder: "Search categories or items...",
    showShortcut: false,
  },
  units: {
    title: "Units Master",
    subtitle: "Define measurement units for items",
  },
  vendor: {
    title: "Vendor Management",
    subtitle: "Manage vendor records and contacts",
  },
  "test-step": {
    title: "Test Step Master",
    subtitle: "Configure inspection step definitions",
  },
  "test-stage": {
    title: "Test Stage Master",
    subtitle: "Configure inspection stage definitions",
  },
  po: {
    title: "Purchase Orders",
    subtitle: "Manage all purchase orders",
  },
  assign_inspector: {
    title: "Assign Inspector",
    subtitle: "Assign inspections to team members",
  },
  "current-inspection": {
    title: "Current Inspection",
    subtitle: "Track live inspection progress",
  },
  reports: {
    title: "Reports",
    subtitle: "View operational reports",
  },
};

function resolveHeaderMeta(pathname: string): HeaderMeta {
  if (pathname.startsWith("/current-inspection/admin/inspections/")) {
    return {
      title: "Inspection Detail",
      subtitle: "Detailed inspection record view",
    };
  }

  if (pathname.startsWith("/po-view/")) {
    return {
      title: "Purchase Order View",
      subtitle: "Inspect purchase order details",
    };
  }

  const key = pathname.replace(/^\/+/, "").split("/")[0] || "dashboard";
  if (key === "") return HEADER_META.dashboard;
  if (key === "dashboard") return HEADER_META.dashboard;
  return HEADER_META[key] || HEADER_META.dashboard;
}

const AppHeader: React.FC = () => {
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { title, subtitle, searchPlaceholder, showShortcut } = resolveHeaderMeta(location.pathname);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="glass sticky top-0 z-20 border-b border-slate-200 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="pl-12 lg:pl-0">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <div className="hidden sm:block h-8 w-px bg-slate-200" />

          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder ?? "Search..."}
              className="w-32 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none lg:w-48"
            />
            {showShortcut !== false && (
              <span className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500">
                Ctrl K
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

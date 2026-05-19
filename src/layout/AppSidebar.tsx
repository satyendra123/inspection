import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import {
  BoxCubeIcon,
  GridIcon,
  GroupIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  TableIcon,
  TaskIcon,
  UserCircleIcon,
  BoxIconLine,
} from "../icons";

type NavItem = {
  label: string;
  path: string;
  icon: ReactNode;
  permission?: string;
};

type NavSection = {
  heading: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    heading: "Main",
    items: [
      {
        label: "Dashboard",
        path: "dashboard",
        icon: <GridIcon />,
      },
    ],
  },
  {
    heading: "Setup",
    items: [
      {
        label: "Company Setup",
        path: "company",
        icon: <BoxCubeIcon />,
        permission: "view_company",
      },
      {
        label: "Projects",
        path: "project",
        icon: <PageIcon />,
        permission: "view_project",
      },
      {
        label: "User roles & permission",
        path: "user",
        icon: <UserCircleIcon />,
        permission: "view_user",
      },
      {
        label: "Categories and items",
        path: "categories",
        icon: <ListIcon />,
        permission: "view_category",
      },
      {
        label: "Units",
        path: "units",
        icon: <PageIcon />,
        permission: "view_unit",
      },
      {
        label: "Vendor",
        path: "vendor",
        icon: <ListIcon />,
        permission: "view_vendor",
      },
    ],
  },
  {
    heading: "Procurement",
    items: [
      {
        label: "Purchase Orders",
        path: "po",
        icon: <PageIcon />,
        permission: "view_po",
      },
      {
        label: "Assign Inspector",
        path: "assign_inspector",
        icon: <UserCircleIcon />,
        permission: "assigninspection_po",
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      {
        label: "Test Stage",
        path: "test-stage",
        icon: <TableIcon />,
        permission: "view_teststage",
      },
      {
        label: "Test Step",
        path: "test-step",
        icon: <TaskIcon />,
        permission: "view_teststep",
      },
      {
        label: "Current Inspection",
        path: "current-inspection",
        icon: <PageIcon />,
        permission: "view_inspection",
      },
    ],
  },
  {
    heading: "Reports",
    items: [
      {
        label: "Reports",
        path: "reports",
        icon: <PieChartIcon />,
        permission: "view_report",
      },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { permissions, user } = useAuth();
  const location = useLocation();

  const hasAccess = (permission?: string) => {
    if (!permission) return true;
    if (permissions.length === 0) return true;
    return permissions.includes(permission);
  };

  const isDashboardActive = (pathname: string) => {
    return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  };

  const isPathActive = (path: string, pathname: string) => {
    if (path === "dashboard") return isDashboardActive(pathname);
    if (path === "po") return pathname.startsWith("/po") || pathname.startsWith("/po-view");
    if (path === "role") return pathname.startsWith("/role");
    if (path === "permission") return pathname.startsWith("/permission");
    if (path === "current-inspection") return pathname.startsWith("/current-inspection");
    return pathname === `/${path}` || pathname.startsWith(`/${path}/`);
  };

  const handleLinkClick = () => {
    if (isMobileOpen) {
      toggleMobileSidebar();
    }
  };

  const displayName = user?.name || "Admin User";
  const displayRole = user?.role || "Administrator";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part: string) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <aside
      className={`mobile-sidebar fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-slate-200 bg-white shadow-xl lg:translate-x-0 lg:shadow-none ${
        isMobileOpen ? "open" : ""
      }`}
    >
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <div className="premium-gradient flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
            <BoxCubeIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">AssetFlow</h1>
            <p className="text-[11px] font-medium text-slate-400">Asset Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {sections.map((section) => {
          const visibleItems = section.items.filter((item) => hasAccess(item.permission));

          if (!visibleItems.length) {
            return null;
          }

          return (
            <div key={section.heading} className="mb-2">
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.heading}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isPathActive(item.path, location.pathname);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleLinkClick}
                      className={`sidebar-link ${active ? "active" : ""}`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center text-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="premium-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
            {initials || "AD"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
            <p className="text-[11px] text-slate-400">{displayRole}</p>
          </div>
          <button className="text-slate-400 transition hover:text-slate-600" type="button" aria-label="More options">
            <HorizontaLDots className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;

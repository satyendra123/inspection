import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowDown,
  FaBuilding,
  FaBoxOpen,
  FaClipboardCheck,
  FaExchangeAlt,
  FaFileUpload,
  FaPrint,
  FaRupeeSign,
  FaPlus,
} from "react-icons/fa";

type StatCard = {
  title: string;
  value: string;
  label: string;
  badge: string;
  badgeClass: string;
  icon: ReactNode;
  iconClass: string;
};

type CategoryBar = {
  label: string;
  value: number;
  width: string;
  barClass: string;
};

type ActivityItem = {
  title: string;
  time: string;
  iconClass: string;
  icon: ReactNode;
};

type QuickAction = {
  label: string;
  icon: ReactNode;
  iconClass: string;
  route: string;
};

const statCards: StatCard[] = [
  {
    title: "Companies",
    value: "3",
    label: "Companies",
    badge: "+2 New",
    badgeClass: "text-emerald-600 bg-emerald-50",
    icon: <FaBuilding className="text-primary-600" />,
    iconClass: "bg-primary-50",
  },
  {
    title: "Total Assets",
    value: "1,247",
    label: "Total Assets",
    badge: "+28 Today",
    badgeClass: "text-emerald-600 bg-emerald-50",
    icon: <FaBoxOpen className="text-amber-600" />,
    iconClass: "bg-amber-50",
  },
  {
    title: "Total Value",
    value: "Rs.84.5L",
    label: "Total Value",
    badge: "Active",
    badgeClass: "text-emerald-600 bg-emerald-50",
    icon: <FaRupeeSign className="text-emerald-600" />,
    iconClass: "bg-emerald-50",
  },
  {
    title: "Depreciation (YTD)",
    value: "Rs.12.3L",
    label: "Depreciation (YTD)",
    badge: "-Rs.2.1L",
    badgeClass: "text-amber-600 bg-amber-50",
    icon: <FaArrowDown className="text-rose-600" />,
    iconClass: "bg-rose-50",
  },
];

const monthlyBars = [
  { month: "Jul", height: "60%", className: "bg-primary-100" },
  { month: "Aug", height: "75%", className: "bg-primary-200" },
  { month: "Sep", height: "50%", className: "bg-primary-300" },
  { month: "Oct", height: "85%", className: "bg-primary-400" },
  { month: "Nov", height: "70%", className: "bg-primary-500" },
  { month: "Dec", height: "95%", className: "bg-primary-600" },
];

const categoryBars: CategoryBar[] = [
  { label: "Furniture & Fixtures", value: 342, width: "68%", barClass: "bg-primary-500" },
  { label: "Electrical", value: 287, width: "57%", barClass: "bg-accent-500" },
  { label: "Computer & IT", value: 198, width: "40%", barClass: "bg-emerald-500" },
  { label: "Plant & Machinery", value: 156, width: "31%", barClass: "bg-amber-500" },
  { label: "Vehicles", value: 89, width: "18%", barClass: "bg-rose-500" },
];

const activityItems: ActivityItem[] = [
  {
    title: "New asset added: Dell Latitude 5520",
    time: "Today, 10:30 AM",
    iconClass: "bg-emerald-50 text-emerald-600",
    icon: <FaPlus className="text-xs" />,
  },
  {
    title: "Stock transfer: 5 items to Site B",
    time: "Yesterday, 4:15 PM",
    iconClass: "bg-blue-50 text-blue-600",
    icon: <FaExchangeAlt className="text-xs" />,
  },
  {
    title: "Reconciliation completed for Q3",
    time: "2 days ago",
    iconClass: "bg-amber-50 text-amber-600",
    icon: <FaClipboardCheck className="text-xs" />,
  },
  {
    title: "Batch tags printed: 25 tags",
    time: "3 days ago",
    iconClass: "bg-purple-50 text-purple-600",
    icon: <FaPrint className="text-xs" />,
  },
];

const quickActions: QuickAction[] = [
  {
    label: "Add Asset",
    icon: <FaPlus className="text-2xl" />,
    iconClass: "text-primary-500",
    route: "/items",
  },
  {
    label: "Bulk Import",
    icon: <FaFileUpload className="text-2xl" />,
    iconClass: "text-accent-500",
    route: "/po",
  },
  {
    label: "Print Tags",
    icon: <FaPrint className="text-2xl" />,
    iconClass: "text-emerald-500",
    route: "/reports",
  },
  {
    label: "Reconcile",
    icon: <FaClipboardCheck className="text-2xl" />,
    iconClass: "text-amber-500",
    route: "/current-inspection",
  },
];

export default function EnterpriseDashboard() {
  const navigate = useNavigate();

  return (
    <div className="fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {statCards.map((card) => (
          <div key={card.title} className="stat-card rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClass}`}>
                {card.icon}
              </div>
              <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${card.badgeClass}`}>
                {card.badge}
              </span>
            </div>
            <p className="text-2xl font-bold text-surface-900">{card.value}</p>
            <p className="mt-1 text-sm text-surface-400">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 mb-6">
        <div className="xl:col-span-2 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-surface-800">Asset Overview</h3>
            <select className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs text-surface-600">
              <option>Last 6 Months</option>
              <option>This Year</option>
              <option>All Time</option>
            </select>
          </div>

          <div className="flex h-48 items-end gap-2 px-2">
            {monthlyBars.map((bar) => (
              <div key={bar.month} className="flex flex-1 flex-col items-center gap-1">
                <div className={`w-full rounded-t-lg ${bar.className}`} style={{ height: bar.height }} />
                <span className="text-[10px] text-surface-400">{bar.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-surface-800">By Category</h3>
          <div className="space-y-3">
            {categoryBars.map((category) => (
              <div key={category.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{category.label}</span>
                  <span className="font-semibold">{category.value}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-100">
                  <div className={`h-2 rounded-full ${category.barClass}`} style={{ width: category.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-surface-800">Recent Activity</h3>
          <div className="space-y-3">
            {activityItems.map((item) => (
              <div key={item.title} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-50">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconClass}`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-800">{item.title}</p>
                  <p className="text-[11px] text-surface-400">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-surface-800">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.route)}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-surface-200 p-4 transition hover:border-primary-400 hover:bg-primary-50"
              >
                <span className={action.iconClass}>{action.icon}</span>
                <span className="text-xs font-semibold text-surface-600">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

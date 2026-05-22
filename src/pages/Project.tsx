import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  Filter,
  IndianRupee,
  Layers3,
  MoreVertical,
  PencilLine,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8060/api";

type ProjectStatus = "Active" | "On Hold" | "Completed" | "Overdue";

type ProjectApiCompany = {
  id?: number;
  company_name?: string;
  name?: string;
};

type ProjectApiRecord = {
  id: number;
  company_id?: number | null;
  project_name?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  Company?: ProjectApiCompany | null;
  company?: ProjectApiCompany | null;
  company_name?: string | null;
};

type ProjectRecord = {
  id: number;
  companyId: number;
  companyName: string;
  projectName: string;
  projectCode: string;
  location: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  totalAssets: number;
  valueInRupees: number;
  description: string;
  createdOn: string;
  updatedOn: string;
  thumbnail: string;
};

type ProjectFilters = {
  search: string;
  status: ProjectStatus | "";
  location: string;
  startDate: string;
  endDate: string;
};

type ProjectFormState = {
  projectName: string;
  projectCode: string;
  location: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  totalValue: string;
  description: string;
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

const PAGE_SIZE = 10;
const PROJECT_IMAGE = "/images/grid-image/image-01.png";

const EMPTY_FILTERS: ProjectFilters = {
  search: "",
  status: "",
  location: "",
  startDate: "",
  endDate: "",
};

const EMPTY_FORM: ProjectFormState = {
  projectName: "",
  projectCode: "",
  location: "",
  status: "Active",
  startDate: "",
  endDate: "",
  totalValue: "",
  description: "",
};

const STATUS_OPTIONS: ProjectStatus[] = ["Active", "On Hold", "Completed", "Overdue"];

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  "On Hold": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
  Completed: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100",
  Overdue: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
};

function safeDateOnly(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value: string) {
  const safeValue = safeDateOnly(value);
  if (!safeValue) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${safeValue}T00:00:00`));
}

function formatDisplayDate(value: string) {
  const safeValue = safeDateOnly(value);
  if (!safeValue) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${safeValue}T00:00:00`));
}

function toProjectStatus(value?: string | null): ProjectStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "inactive") return "On Hold";
  if (normalized === "completed") return "Completed";
  if (normalized === "overdue") return "Overdue";
  return "Active";
}

function formatRupeeCr(valueInRupees: number) {
  return `\u20B9 ${(valueInRupees / 10000000).toFixed(2)} Cr`;
}

function getProjectsFromResponse(payload: any): ProjectApiRecord[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.projects)) return payload.projects;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function normalizeProject(project: ProjectApiRecord, index: number): ProjectRecord {
  const companySource = project.Company || project.company || {};
  const companyId = Number(project.company_id ?? companySource.id ?? 0) || 0;
  const companyName =
    companySource.company_name ||
    companySource.name ||
    project.company_name ||
    (companyId ? `Company #${companyId}` : `Company #${project.id}`);
  const createdOn = safeDateOnly(project.createdAt) || new Date().toISOString().slice(0, 10);
  const updatedOn = safeDateOnly(project.updatedAt) || createdOn;
  const metricSeed = Math.max(1, companyId || Number(project.id) || index + 1);

  return {
    id: Number(project.id),
    companyId,
    companyName,
    projectName: project.project_name || `Project ${project.id}`,
    projectCode: `PRJ-${String(project.id).padStart(4, "0")}`,
    location: companyName,
    startDate: createdOn,
    endDate: updatedOn,
    status: toProjectStatus(project.status),
    totalAssets: metricSeed,
    valueInRupees: metricSeed * 1000000,
    description: `Project ${project.project_name || project.id} linked to ${companyName}.`,
    createdOn,
    updatedOn,
    thumbnail: PROJECT_IMAGE,
  };
}

function buildStatCards(projects: ProjectRecord[]): StatCardConfig[] {
  const totalProjects = projects.length;
  const activeProjects = projects.filter((project) => project.status === "Active").length;
  const onHoldProjects = projects.filter((project) => project.status === "On Hold").length;
  const completedProjects = projects.filter((project) => project.status === "Completed").length;
  const overdueProjects = projects.filter((project) => project.status === "Overdue").length;
  const totalValue = projects.reduce((sum, project) => sum + project.valueInRupees, 0);

  const percent = (count: number) =>
    totalProjects > 0 ? `${Math.round((count / totalProjects) * 100)}% of total` : "0% of total";

  return [
    {
      label: "Total Projects",
      value: String(totalProjects),
      trend: totalProjects > 0 ? "Live API" : "No data",
      direction: "up",
      icon: BriefcaseBusiness,
      iconClass: "text-violet-600",
      tintClass: "bg-violet-100",
    },
    {
      label: "Active Projects",
      value: String(activeProjects),
      trend: percent(activeProjects),
      direction: activeProjects > 0 ? "up" : "down",
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
      tintClass: "bg-emerald-100",
    },
    {
      label: "On Hold",
      value: String(onHoldProjects),
      trend: percent(onHoldProjects),
      direction: onHoldProjects > 0 ? "down" : "up",
      icon: Clock3,
      iconClass: "text-amber-600",
      tintClass: "bg-amber-100",
    },
    {
      label: "Completed",
      value: String(completedProjects),
      trend: percent(completedProjects),
      direction: completedProjects > 0 ? "up" : "down",
      icon: CheckCircle2,
      iconClass: "text-violet-600",
      tintClass: "bg-violet-100",
    },
    {
      label: "Overdue",
      value: String(overdueProjects),
      trend: percent(overdueProjects),
      direction: overdueProjects > 0 ? "down" : "up",
      icon: CircleAlert,
      iconClass: "text-rose-600",
      tintClass: "bg-rose-100",
    },
    {
      label: "Total Value",
      value: formatRupeeCr(totalValue),
      trend: `${totalProjects} project${totalProjects === 1 ? "" : "s"}`,
      direction: "up",
      icon: Layers3,
      iconClass: "text-sky-600",
      tintClass: "bg-sky-100",
    },
  ];
}

function projectToForm(project?: ProjectRecord | null): ProjectFormState {
  if (!project) return EMPTY_FORM;
  return {
    projectName: project.projectName,
    projectCode: project.projectCode,
    location: project.location,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    totalValue: String(project.valueInRupees),
    description: project.description,
  };
}

function StatCard({
  label,
  value,
  trend,
  direction,
  icon: Icon,
  iconClass,
  tintClass,
}: StatCardConfig) {
  return (
    <article className="stat-card overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${tintClass}`}>
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="whitespace-nowrap text-[11px] font-medium leading-none text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold leading-none tracking-tight text-slate-900">
            {value}
          </p>
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

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ModalFrame({
  title,
  subtitle,
  onClose,
  maxWidthClass,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  maxWidthClass: string;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${maxWidthClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Close ${title.toLowerCase()} popup`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export default function Project() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [draftFilters, setDraftFilters] = useState<ProjectFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ProjectFilters>(EMPTY_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formState, setFormState] = useState<ProjectFormState>(EMPTY_FORM);

  const token = localStorage.getItem("token") || "";
  const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/projects`, axiosConfig);
      const normalizedProjects = getProjectsFromResponse(response.data).map((project, index) =>
        normalizeProject(project, index),
      );
      setProjects(normalizedProjects);
      setSelectedProjectId((current) =>
        current && normalizedProjects.some((project) => project.id === current)
          ? current
          : normalizedProjects[0]?.id ?? 0,
      );
    } catch (error) {
      console.error("Failed to fetch projects", error);
      setProjects([]);
      setSelectedProjectId(0);
      setError("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locations = useMemo(
    () => Array.from(new Set(projects.map((project) => project.location))).sort((a, b) =>
      a.localeCompare(b),
    ),
    [projects],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const statCards = useMemo(() => buildStatCards(projects), [projects]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDetailsOpen(false);
        setIsEditOpen(false);
      }
    };

    if (isDetailsOpen || isEditOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetailsOpen, isEditOpen]);

  const filteredProjects = useMemo(() => {
    const search = appliedFilters.search.trim().toLowerCase();

    return projects.filter((project) => {
      if (search) {
        const haystack = `${project.projectName} ${project.projectCode} ${project.location}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (appliedFilters.status && project.status !== appliedFilters.status) {
        return false;
      }

      if (appliedFilters.location && project.location !== appliedFilters.location) {
        return false;
      }

      if (appliedFilters.startDate && project.startDate < appliedFilters.startDate) {
        return false;
      }

      if (appliedFilters.endDate && project.endDate > appliedFilters.endDate) {
        return false;
      }

      return true;
    });
  }, [appliedFilters, projects]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const pageProjects = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProjects, safeCurrentPage]);

  const pageStart = filteredProjects.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, filteredProjects.length);

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  };

  const handleOpenDetails = (projectId: number) => {
    setSelectedProjectId(projectId);
    setIsDetailsOpen(true);
    setIsEditOpen(false);
  };

  const handleOpenEdit = (projectId: number) => {
    const nextProject = projects.find((project) => project.id === projectId);
    if (!nextProject) {
      return;
    }

    setSelectedProjectId(projectId);
    setFormState(projectToForm(nextProject));
    setIsEditOpen(true);
    setIsDetailsOpen(false);
  };

  const handleUpdateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    if (!formState.projectName.trim()) {
      setError("Project name is required");
      return;
    }

    try {
      await axios.put(
        `${API}/projects/${selectedProject.id}`,
        {
          company_id: selectedProject.companyId || undefined,
          project_name: formState.projectName.trim(),
          status: formState.status === "Active" ? "active" : "inactive",
        },
        axiosConfig,
      );
      setMessage("Project updated successfully");
      setIsEditOpen(false);
      await fetchProjects();
    } catch (error) {
      console.error("Failed to update project", error);
      setError("Failed to update project");
    }
  };

  const maintenanceCount = selectedProject ? Math.round(selectedProject.totalAssets * 0.0875) : 0;
  const completedAssetCount = selectedProject ? Math.round(selectedProject.totalAssets * 0.14) : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-6">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-sm font-medium text-violet-600 transition hover:text-violet-700"
            >
              Reset
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={draftFilters.search}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
                  }
                  placeholder="Search project..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </span>
              <select
                value={draftFilters.status}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    status: event.target.value as ProjectStatus | "",
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">Select status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Location
              </span>
              <select
                value={draftFilters.location}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start Date
              </span>
              <input
                type="date"
                value={draftFilters.startDate}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                End Date
              </span>
              <input
                type="date"
                value={draftFilters.endDate}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
              >
                <Filter className="h-4 w-4" />
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">All Projects ({filteredProjects.length})</h3>
              <p className="mt-1 text-sm text-slate-500">Manage project records, status, and value.</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="!w-full !border-0 !bg-transparent !rounded-none">
              <thead>
                <tr className="!bg-white">
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    #
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Project Name
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Project Code
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Location
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Start Date
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    End Date
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Total Assets
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Value
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageProjects.length > 0 ? (
                  pageProjects.map((project, index) => {
                    const rowNumber = (safeCurrentPage - 1) * PAGE_SIZE + index + 1;
                    const isSelected = project.id === selectedProjectId;

                    return (
                      <tr
                        key={project.id}
                        onClick={() => handleOpenDetails(project.id)}
                        className={`table-row cursor-pointer border-t border-slate-100 transition ${
                          isSelected ? "bg-violet-50/70" : "bg-white"
                        }`}
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{rowNumber}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-800">
                          {project.projectName}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {project.projectCode}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {project.location}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatShortDate(project.startDate)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatShortDate(project.endDate)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge status={project.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {project.totalAssets}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">
                          {formatRupeeCr(project.valueInRupees)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5 text-slate-500">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenDetails(project.id);
                              }}
                              className="rounded-lg p-2 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={`View ${project.projectName}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenEdit(project.id);
                              }}
                              className="rounded-lg p-2 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={`Edit ${project.projectName}`}
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Delete ${project.projectName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-lg p-2 transition hover:bg-slate-100 hover:text-slate-700"
                              aria-label={`More actions for ${project.projectName}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center text-sm text-slate-500">
                      {isLoading ? "Loading projects from API..." : "No projects match the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing {pageStart} to {pageEnd} of {filteredProjects.length} entries
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
                    page === safeCurrentPage
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {isDetailsOpen && selectedProject ? (
        <ModalFrame
          title="Project Details"
          subtitle={`View full project information for ${selectedProject.projectName}`}
          onClose={() => setIsDetailsOpen(false)}
          maxWidthClass="max-w-5xl"
        >
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <img
                src={selectedProject.thumbnail}
                alt={selectedProject.projectName}
                className="h-48 w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
              />

              <div className="mt-4 space-y-3">
                <StatusBadge status={selectedProject.status} />
                <div className="space-y-1 text-sm text-slate-600">
                  <p>
                    <span className="font-medium text-slate-800">Created on:</span>{" "}
                    {formatDisplayDate(selectedProject.createdOn)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Last updated:</span>{" "}
                    {formatDisplayDate(selectedProject.updatedOn)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div>
                  <h4 className="text-2xl font-semibold text-slate-900">{selectedProject.projectName}</h4>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-slate-400">
                    {selectedProject.projectCode}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                  <span className="font-medium text-slate-500">Location</span>
                  <span className="text-slate-700">{selectedProject.location}</span>
                </div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                  <span className="font-medium text-slate-500">Start Date</span>
                  <span className="text-slate-700">{formatDisplayDate(selectedProject.startDate)}</span>
                </div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                  <span className="font-medium text-slate-500">End Date</span>
                  <span className="text-slate-700">{formatDisplayDate(selectedProject.endDate)}</span>
                </div>
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
                  <span className="font-medium text-slate-500">Description</span>
                  <span className="leading-6 text-slate-700">{selectedProject.description}</span>
                </div>
              </div>

              <div className="my-5 border-t border-slate-100" />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile icon={Layers3} label="Total Assets" value={String(selectedProject.totalAssets)} />
                <MetricTile icon={IndianRupee} label="Total Value" value={formatRupeeCr(selectedProject.valueInRupees)} />
                <MetricTile icon={Clock3} label="In Maintenance" value={String(maintenanceCount)} />
                <MetricTile icon={CheckCircle2} label="Completed" value={String(completedAssetCount)} />
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {isEditOpen && selectedProject ? (
        <ModalFrame
          title="Edit Project"
          subtitle="Update the currently selected project record"
          onClose={() => setIsEditOpen(false)}
          maxWidthClass="max-w-4xl"
        >
          <form onSubmit={handleUpdateProject} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Project Name <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  value={formState.projectName}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, projectName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status <span className="text-rose-500">*</span>
                </span>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      status: event.target.value as ProjectStatus,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Project Code <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  value={formState.projectCode}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, projectCode: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  End Date <span className="text-rose-500">*</span>
                </span>
                <input
                  type="date"
                  value={formState.endDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location <span className="text-rose-500">*</span>
                </span>
                <select
                  value={formState.location}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, location: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                >
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Value ({String.fromCharCode(8377)}) <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formState.totalValue}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, totalValue: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start Date <span className="text-rose-500">*</span>
                </span>
                <input
                  type="date"
                  value={formState.startDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </span>
              <textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (selectedProject) {
                    setFormState(projectToForm(selectedProject));
                  }
                  setIsEditOpen(false);
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
              >
                Update Project
              </button>
            </div>
          </form>
        </ModalFrame>
      ) : null}
    </div>
  );
}

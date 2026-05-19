import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Clock3,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Layers3,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { api } from "../utils/apiClient";

type ReportDocument = {
  name: string;
  url: string;
  mime?: string;
};

type ReportTest = {
  history_id: number;
  test_id: number;
  test_name: string;
  status: string;
  result: string | null;
  quantity: number;
  pass_quantity: number;
  fail_quantity: number;
  remarks: string;
  description: string;
  gps_location: string;
  docs_count: number;
  reported_on: string | null;
  documents: ReportDocument[];
};

type ReportStage = {
  stage_id: number | null;
  po_stage_id: number | null;
  stage_name: string;
  status: string;
  batch_id: number | null;
  inspector_name: string;
  started_on: string | null;
  completed_on: string | null;
  duration_days: number;
  updated_at: string | null;
  tests_count: number;
  docs_count: number;
  tests: ReportTest[];
};

type ReportRow = {
  report_key: string;
  inspection_id: number;
  assignment_id: number | null;
  po_id: number | null;
  purchase_order_item_id: number | null;
  company_name: string;
  project_name: string;
  po_number: string;
  po_date: string;
  delivery_date: string;
  vendor_name: string;
  item_name: string;
  status: string;
  report_bucket: "completed" | "failed" | "active";
  report_result: string;
  contains_failed_tests: boolean;
  current_stage_name: string;
  current_stage_result: string;
  current_stage_inspector: string;
  inspection_date: string | null;
  assigned_on: string | null;
  inspection_started_on: string | null;
  completed_on: string | null;
  inspection_duration_days: number;
  total_stages: number;
  completed_stages: number;
  total_tests: number;
  total_documents: number;
  remarks: string;
  attachment: string | null;
  design_copy: string | null;
  latest_activity_at: string | null;
  stages: ReportStage[];
};

type ReportSummary = {
  totalReports: number;
  completedReports: number;
  failedReports: number;
  activeReports: number;
  totalStages: number;
  totalTests: number;
  totalDocuments: number;
};

type ProjectOption = {
  project_name: string;
  company_name: string;
  report_count: number;
};

type ItemOption = {
  purchase_order_item_id: number;
  item_name: string;
  project_name: string;
  po_number: string;
  company_name: string;
};

type FilterOptions = {
  projects: ProjectOption[];
  items: ItemOption[];
  statuses: string[];
};

type ReportFilters = {
  search: string;
  date_from: string;
  date_to: string;
  project_name: string;
  purchase_order_item_id: string;
};

type ReportsApiResponse = {
  success?: boolean;
  data?: ReportRow[];
  summary?: Partial<ReportSummary>;
  filterOptions?: Partial<FilterOptions>;
  appliedFilters?: Partial<ReportFilters>;
};

const DEFAULT_FILTERS: ReportFilters = {
  search: "",
  date_from: "",
  date_to: "",
  project_name: "",
  purchase_order_item_id: "",
};

const DEFAULT_SUMMARY: ReportSummary = {
  totalReports: 0,
  completedReports: 0,
  failedReports: 0,
  activeReports: 0,
  totalStages: 0,
  totalTests: 0,
  totalDocuments: 0,
};

const DEFAULT_OPTIONS: FilterOptions = {
  projects: [],
  items: [],
  statuses: [],
};

function normalizeReportDocumentUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "#";

  const normalizePath = (pathname: string) => {
    const cleanPath = `/${pathname.replace(/^\/+/, "")}`;
    if (/^\/api\/uploads\//i.test(cleanPath)) return cleanPath;
    if (/^\/uploads\//i.test(cleanPath)) return `/api${cleanPath}`;
    return cleanPath;
  };

  try {
    const parsed = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, window.location.origin);
    parsed.pathname = normalizePath(parsed.pathname);
    return parsed.toString();
  } catch {
    return raw;
  }
}

export default function Reports() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(DEFAULT_SUMMARY);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDraft, setFilterDraft] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get<ReportsApiResponse>("/admin/reports", {
          params: {
            ...filters,
            purchase_order_item_id: filters.purchase_order_item_id || undefined,
            project_name: filters.project_name || undefined,
            date_from: filters.date_from || undefined,
            date_to: filters.date_to || undefined,
            search: filters.search || undefined,
          },
        });

        if (cancelled) return;

        const payload = response.data || {};
        setRows(Array.isArray(payload.data) ? payload.data : []);
        setSummary({
          totalReports: Number(payload.summary?.totalReports || 0),
          completedReports: Number(payload.summary?.completedReports || 0),
          failedReports: Number(payload.summary?.failedReports || 0),
          activeReports: Number(payload.summary?.activeReports || 0),
          totalStages: Number(payload.summary?.totalStages || 0),
          totalTests: Number(payload.summary?.totalTests || 0),
          totalDocuments: Number(payload.summary?.totalDocuments || 0),
        });
        setFilterOptions({
          projects: Array.isArray(payload.filterOptions?.projects) ? payload.filterOptions?.projects : [],
          items: Array.isArray(payload.filterOptions?.items) ? payload.filterOptions?.items : [],
          statuses: Array.isArray(payload.filterOptions?.statuses) ? payload.filterOptions?.statuses : [],
        });
      } catch (requestError: any) {
        if (cancelled) return;
        setRows([]);
        setSummary(DEFAULT_SUMMARY);
        setError(requestError?.response?.data?.message || "Unable to load report data right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const availableItems = filterOptions.items.filter((item) => {
    if (!filterDraft.project_name) return true;
    return item.project_name === filterDraft.project_name;
  });

  const completedReports = rows.filter((row) => row.report_bucket === "completed");
  const failedReports = rows.filter((row) => row.report_bucket === "failed");
  const activeReports = rows.filter((row) => row.report_bucket === "active");

  const applyFilters = () => {
    const normalizedFilters: ReportFilters = {
      search: filterDraft.search.trim(),
      date_from: filterDraft.date_from,
      date_to: filterDraft.date_to,
      project_name: filterDraft.project_name,
      purchase_order_item_id: filterDraft.purchase_order_item_id,
    };

    setFilters(normalizedFilters);
  };

  const resetFilters = () => {
    setFilterDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  const handleProjectChange = (projectName: string) => {
    setFilterDraft((previous) => {
      const nextItemStillValid = filterOptions.items.some(
        (item) =>
          String(item.purchase_order_item_id) === previous.purchase_order_item_id &&
          (!projectName || item.project_name === projectName),
      );

      return {
        ...previous,
        project_name: projectName,
        purchase_order_item_id: nextItemStillValid ? previous.purchase_order_item_id : "",
      };
    });
  };

  const downloadBlobResponse = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSummary = async (format: "xlsx" | "pdf") => {
    const exportKey = `summary:${format}`;
    setExportingKey(exportKey);

    try {
      const response = await api.get("/admin/reports/export", {
        params: {
          ...filters,
          format,
        },
        responseType: "blob",
      });

      const contentType =
        response.headers["content-type"] ||
        (format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf");
      const blob = new Blob([response.data], { type: contentType });
      const disposition = String(response.headers["content-disposition"] || "");
      const matchedName = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const fileName = matchedName?.[1] || `inspection-report.${format}`;

      downloadBlobResponse(blob, fileName);
    } finally {
      setExportingKey(null);
    }
  };

  const handleDownloadDetailedPdf = async (report: ReportRow) => {
    const exportKey = `detailed:${report.report_key}`;
    setExportingKey(exportKey);

    try {
      const response = await api.get("/admin/reports/export", {
        params: {
          ...filters,
          format: "pdf",
          scope: "detailed",
          inspection_id: report.inspection_id,
          purchase_order_item_id: report.purchase_order_item_id || undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/pdf",
      });
      const disposition = String(response.headers["content-disposition"] || "");
      const matchedName = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const fileName = matchedName?.[1] || `inspection-detailed-report-${report.inspection_id}.pdf`;

      downloadBlobResponse(blob, fileName);
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 px-5 py-6 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)] sm:px-7 sm:py-7 lg:px-9 lg:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_36%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.4fr_0.6fr] xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-300">Inspection Reporting</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
              Passed, failed, and completed item reports in one professional report desk.
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
              Apply date-between filters, narrow by project and item, review complete stage-wise test history, and
              download one consolidated PDF for the selected inspection item.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <InsightBox label="Visible Reports" value={formatNumber(summary.totalReports)} />
            <InsightBox label="Completed" value={formatNumber(summary.completedReports)} />
            <InsightBox label="Failed" value={formatNumber(summary.failedReports)} />
            <InsightBox label="Documents" value={formatNumber(summary.totalDocuments)} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Completed Reports"
          value={formatNumber(summary.completedReports)}
          helper="Closed inspections ready for consolidated print"
          accent="from-emerald-600 via-emerald-500 to-teal-400"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          title="Failed Reports"
          value={formatNumber(summary.failedReports)}
          helper="Failed or rework history captured in reports"
          accent="from-rose-600 via-rose-500 to-orange-400"
          icon={<XCircle className="h-5 w-5" />}
        />
        <MetricCard
          title="Open Reports"
          value={formatNumber(summary.activeReports)}
          helper="Assigned or in-progress inspections still active"
          accent="from-sky-600 via-sky-500 to-cyan-400"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <MetricCard
          title="Stage/Test Footprint"
          value={`${formatNumber(summary.totalStages)} / ${formatNumber(summary.totalTests)}`}
          helper={`${formatNumber(summary.totalDocuments)} linked report documents in current result set`}
          accent="from-slate-950 via-slate-800 to-slate-700"
          icon={<Layers3 className="h-5 w-5" />}
        />
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_70px_-45px_rgba(15,23,42,0.4)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_42%,#eff6ff_100%)] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Date Between Filters</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Filter reports exactly the way operations needs</h2>
              <p className="mt-1 text-sm text-slate-600">
                First select from date, then till date, then project, then item, and finally apply filters.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExportSummary("xlsx")}
                disabled={loading || exportingKey !== null}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exportingKey === "summary:xlsx" ? "Preparing Excel..." : "Download Excel"}
              </button>
              <button
                onClick={() => handleExportSummary("pdf")}
                disabled={loading || exportingKey !== null}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {exportingKey === "summary:pdf" ? "Preparing PDF..." : "Summary PDF"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
            <label className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-slate-400 focus-within:shadow-md">
              <Search className="h-4 w-4 text-slate-400 transition group-focus-within:text-slate-700" />
              <input
                value={filterDraft.search}
                onChange={(event) => setFilterDraft((previous) => ({ ...previous, search: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="Search by company, project, PO, item, stage, test, or remarks"
                className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>

            <DateField
              label="From Date"
              value={filterDraft.date_from}
              onChange={(value) => setFilterDraft((previous) => ({ ...previous, date_from: value }))}
            />
            <DateField
              label="Till Date"
              value={filterDraft.date_to}
              onChange={(value) => setFilterDraft((previous) => ({ ...previous, date_to: value }))}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1.4fr_auto_auto]">
            <FilterSelect
              label="Project"
              value={filterDraft.project_name}
              onChange={handleProjectChange}
              allLabel="All projects"
              icon={<FolderKanban className="h-4 w-4" />}
              options={filterOptions.projects.map((project) => ({
                value: project.project_name,
                label: project.project_name,
                helper: `${project.company_name || "No company"} | ${project.report_count} reports`,
              }))}
            />
            <FilterSelect
              label="Item"
              value={filterDraft.purchase_order_item_id}
              onChange={(value) => setFilterDraft((previous) => ({ ...previous, purchase_order_item_id: value }))}
              allLabel="All items"
              icon={<Layers3 className="h-4 w-4" />}
              options={availableItems.map((item) => ({
                value: String(item.purchase_order_item_id),
                label: item.item_name,
                helper: `${item.project_name} | ${item.po_number}`,
              }))}
            />
            <button
              onClick={applyFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Filter className="h-4 w-4" />
              Apply Filters
            </button>
            <button
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStrip label="Date Between" value={`${filters.date_from || "All"} to ${filters.date_to || "All"}`} />
            <SummaryStrip label="Project" value={filters.project_name || "All projects"} />
            <SummaryStrip
              label="Item"
              value={
                filterOptions.items.find((item) => String(item.purchase_order_item_id) === filters.purchase_order_item_id)
                  ?.item_name || "All items"
              }
            />
            <SummaryStrip label="Search" value={filters.search || "No search applied"} />
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-3xl bg-slate-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState onReset={resetFilters} />
          ) : (
            <div className="mt-6 space-y-8">
              <ReportSection
                title="Completed Reports"
                subtitle="Every completed inspection item with full stage-wise and test-wise history."
                tone="completed"
                count={completedReports.length}
                reports={completedReports}
                exportingKey={exportingKey}
                busy={Boolean(exportingKey)}
                onDownloadDetailed={handleDownloadDetailedPdf}
              />
              <ReportSection
                title="Failed / Rework Reports"
                subtitle="Failed tests and rework-driven inspections are visible here without dropping history."
                tone="failed"
                count={failedReports.length}
                reports={failedReports}
                exportingKey={exportingKey}
                busy={Boolean(exportingKey)}
                onDownloadDetailed={handleDownloadDetailedPdf}
              />
              <ReportSection
                title="Open / In Progress Reports"
                subtitle="Assigned and running inspections remain available in the same reporting view."
                tone="active"
                count={activeReports.length}
                reports={activeReports}
                exportingKey={exportingKey}
                busy={Boolean(exportingKey)}
                onDownloadDetailed={handleDownloadDetailedPdf}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  accent,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">{icon}</div>
        </div>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-600">{helper}</p>
      </div>
    </article>
  );
}

function InsightBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <CalendarRange className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-800 outline-none"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; helper: string }>;
  allLabel: string;
  icon: ReactNode;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border-0 bg-transparent p-0 text-sm font-medium text-slate-800 outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label} {option.helper ? `| ${option.helper}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ReportSection({
  title,
  subtitle,
  tone,
  count,
  reports,
  exportingKey,
  busy,
  onDownloadDetailed,
}: {
  title: string;
  subtitle: string;
  tone: "completed" | "failed" | "active";
  count: number;
  reports: ReportRow[];
  exportingKey: string | null;
  busy: boolean;
  onDownloadDetailed: (report: ReportRow) => Promise<void>;
}) {
  const toneClasses =
    tone === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClasses}`}>
          {formatNumber(count)} reports
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-600">
          No reports in this section for the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard
              key={report.report_key}
              report={report}
              exporting={exportingKey === `detailed:${report.report_key}`}
              busy={busy}
              onDownloadDetailed={onDownloadDetailed}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportCard({
  report,
  exporting,
  busy,
  onDownloadDetailed,
}: {
  report: ReportRow;
  exporting: boolean;
  busy: boolean;
  onDownloadDetailed: (report: ReportRow) => Promise<void>;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={report.report_result} />
              <StatusPill value={toLabel(report.status)} subtle />
              {report.contains_failed_tests && (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Failed history included
                </span>
              )}
            </div>
            <h4 className="mt-3 text-xl font-semibold text-slate-900">{report.item_name || "Unnamed item"}</h4>
            <p className="mt-1 text-sm text-slate-600">
              {report.project_name || "-"} | {report.po_number || "-"} | {report.company_name || "-"}
            </p>
          </div>

          <button
            onClick={() => onDownloadDetailed(report)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {exporting
              ? "Preparing PDF..."
              : report.report_bucket === "completed"
                ? "Completed Report PDF"
                : "Detailed Report PDF"}
          </button>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryStrip label="Vendor / Inspector" value={`${report.vendor_name || "-"} / ${report.current_stage_inspector || "-"}`} />
          <SummaryStrip label="Dates" value={`${formatDateTime(report.inspection_date)} / ${formatDateTime(report.completed_on) || "-"}`} />
          <SummaryStrip label="Progress" value={`${report.completed_stages}/${report.total_stages} stages | ${report.total_tests} tests`} />
          <SummaryStrip label="Documents / Days" value={`${report.total_documents} docs | ${report.inspection_duration_days} days`} />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Current Stage:</span> {report.current_stage_name || "-"} |{" "}
          <span className="font-semibold text-slate-900">Stage Result:</span> {report.current_stage_result || "-"}
          <div className="mt-2 text-slate-600">{report.remarks || "No remarks recorded for this inspection item."}</div>
        </div>

        <div className="mt-5 space-y-3">
          {report.stages.map((stage) => (
            <details
              key={`${report.report_key}-${stage.po_stage_id || stage.stage_id || stage.stage_name}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <summary className="cursor-pointer list-none px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{stage.stage_name || "Unnamed stage"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Inspector {stage.inspector_name || "-"} | Tests {stage.tests_count} | Documents {stage.docs_count}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill value={toLabel(stage.status)} subtle />
                    <span className="text-xs font-medium text-slate-500">
                      {formatDateTime(stage.started_on)} to {formatDateTime(stage.completed_on) || "-"}
                    </span>
                  </div>
                </div>
              </summary>

              <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                <div className="grid gap-3">
                  {stage.tests.map((testRow) => (
                    <div
                      key={`${stage.po_stage_id || stage.stage_id}-${testRow.history_id}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{testRow.test_name || "Unnamed test"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Reported on {formatDateTime(testRow.reported_on)} | Qty {formatNumber(testRow.quantity)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill value={toLabel(testRow.status)} subtle />
                          <StatusPill value={toLabel(testRow.result || "pending")} />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryStrip label="Pass Qty" value={formatNumber(testRow.pass_quantity)} />
                        <SummaryStrip label="Fail Qty" value={formatNumber(testRow.fail_quantity)} />
                        <SummaryStrip label="Documents" value={formatNumber(testRow.docs_count)} />
                        <SummaryStrip label="GPS" value={testRow.gps_location || "-"} />
                      </div>

                      {(testRow.remarks || testRow.description) && (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <p>{testRow.remarks || "No test remarks."}</p>
                          {testRow.description && <p className="mt-2 text-slate-600">{testRow.description}</p>}
                        </div>
                      )}

                      {testRow.documents.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {testRow.documents.map((document, index) => (
                            <a
                              key={`${document.url}-${index}`}
                              href={normalizeReportDocumentUrl(document.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {document.name || `Document ${index + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ value, subtle = false }: { value: string; subtle?: boolean }) {
  const tone = subtle ? secondaryResultTone(value) : primaryResultTone(value);

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {value || "-"}
    </span>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No reports match these filters</h3>
      <p className="mt-2 text-sm text-slate-600">
        Reset the filters or expand the date range to bring report data back.
      </p>
      <button
        onClick={onReset}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <RefreshCcw className="h-4 w-4" />
        Reset Filters
      </button>
    </div>
  );
}

function primaryResultTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("pass") || normalized.includes("complete")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("fail") || normalized.includes("reject")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function secondaryResultTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("pass") || normalized.includes("complete")) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("fail") || normalized.includes("reject") || normalized.includes("rework")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized.includes("progress") || normalized.includes("assign")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function toLabel(value: string) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

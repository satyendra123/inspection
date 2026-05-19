import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CircleCheckBig,
  CircleX,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Grid3X3,
  Layers3,
  PencilLine,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import { useLocation } from "react-router-dom";

type Status = "Active" | "Inactive";

type CategoryRecord = {
  id: number;
  category_name: string;
  description: string;
  total_items: number;
  status: Status;
};

type ItemRecord = {
  id: number;
  item_name: string;
  item_code: string;
  category_id: number;
  unit: string;
  description: string;
  status: Status;
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

type CategoryFormState = {
  category_name: string;
  description: string;
  status: Status;
};

type ItemFormState = {
  item_name: string;
  item_code: string;
  category_id: string;
  unit: string;
  description: string;
  status: Status;
};

type ViewState =
  | { type: "category"; record: CategoryRecord }
  | { type: "item"; record: ItemRecord }
  | null;

const CATEGORY_PAGE_SIZE = 5;
const ITEM_PAGE_SIZE = 5;

const CATEGORY_STATS: Omit<StatCardConfig, "value">[] = [
  {
    label: "Total Categories",
    trend: "12.5% from last month",
    direction: "up",
    icon: Grid3X3,
    iconClass: "text-violet-600",
    tintClass: "bg-violet-100",
  },
  {
    label: "Total Items",
    value: "1,248",
    trend: "8.7% from last month",
    direction: "up",
    icon: Layers3,
    iconClass: "text-blue-600",
    tintClass: "bg-blue-100",
  },
  {
    label: "Active Items",
    value: "1,102",
    trend: "7.6% from last month",
    direction: "up",
    icon: CircleCheckBig,
    iconClass: "text-emerald-600",
    tintClass: "bg-emerald-100",
  },
  {
    label: "Inactive Items",
    value: "146",
    trend: "4.3% from last month",
    direction: "down",
    icon: CircleX,
    iconClass: "text-rose-600",
    tintClass: "bg-rose-100",
  },
];

const CATEGORY_BADGES = [
  "bg-violet-50 text-violet-700 ring-violet-100",
  "bg-blue-50 text-blue-700 ring-blue-100",
  "bg-amber-50 text-amber-700 ring-amber-100",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-rose-50 text-rose-700 ring-rose-100",
];

const STATUS_STYLES: Record<Status, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  Inactive: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
};

const UNIT_OPTIONS = ["Nos", "Pcs", "Set", "Box", "Kg"];

function buildInitialCategories(): CategoryRecord[] {
  const baseCategories: CategoryRecord[] = [
    {
      id: 1,
      category_name: "IT Equipment",
      description: "Computers, laptops, printers and other IT peripherals",
      total_items: 245,
      status: "Active",
    },
    {
      id: 2,
      category_name: "Furniture & Fixtures",
      description: "Office furniture, fixtures and fittings",
      total_items: 186,
      status: "Active",
    },
    {
      id: 3,
      category_name: "Electrical Equipment",
      description: "Electrical appliances and equipment",
      total_items: 164,
      status: "Active",
    },
    {
      id: 4,
      category_name: "Vehicles",
      description: "Company vehicles and transportation",
      total_items: 98,
      status: "Active",
    },
    {
      id: 5,
      category_name: "Machinery",
      description: "Heavy machinery and tools",
      total_items: 132,
      status: "Inactive",
    },
  ];

  const extraCategories = Array.from({ length: 27 }, (_, index) => {
    const categoryNumber = index + 6;
    return {
      id: categoryNumber,
      category_name: `Category ${categoryNumber}`,
      description: `Master category ${categoryNumber}`,
      total_items: 12 + ((index * 7) % 19),
      status: index % 6 === 0 ? "Inactive" : "Active",
    } satisfies CategoryRecord;
  });

  return [...baseCategories, ...extraCategories];
}

function buildInitialItems(): ItemRecord[] {
  const sampleItems: ItemRecord[] = [
    {
      id: 1,
      item_name: "Dell Latitude 5420 Laptop",
      item_code: "IT-IT-0001",
      category_id: 1,
      unit: "Nos",
      description: "Business laptop",
      status: "Active",
    },
    {
      id: 2,
      item_name: "HP LaserJet Pro Printer",
      item_code: "IT-IT-0002",
      category_id: 1,
      unit: "Nos",
      description: "Monochrome printer",
      status: "Active",
    },
    {
      id: 3,
      item_name: "Office Table",
      item_code: "FF-FT-0001",
      category_id: 2,
      unit: "Nos",
      description: "Work table",
      status: "Active",
    },
    {
      id: 4,
      item_name: "Ergonomic Office Chair",
      item_code: "FF-FT-0002",
      category_id: 2,
      unit: "Nos",
      description: "Adjustable chair",
      status: "Active",
    },
    {
      id: 5,
      item_name: "Split AC 1.5 Ton",
      item_code: "EL-EL-0001",
      category_id: 3,
      unit: "Nos",
      description: "Air conditioning unit",
      status: "Active",
    },
  ];

  const generatedItems: ItemRecord[] = [];
  const activeTarget = 1102;
  const startIndex = sampleItems.length + 1;

  let activeCount = sampleItems.filter((item) => item.status === "Active").length;
  let inactiveCount = sampleItems.length - activeCount;

  for (let id = startIndex; id <= 1248; id += 1) {
    const templateIndex = (id - 1) % 8;
    const categoryId = ((id - 1) % 32) + 1;
    const unit = UNIT_OPTIONS[(id - 1) % UNIT_OPTIONS.length];
    const isActive = activeCount < activeTarget;

    if (isActive) {
      activeCount += 1;
    } else {
      inactiveCount += 1;
    }

    generatedItems.push({
      id,
      item_name: `Asset Item ${id}`,
      item_code: `IT-IT-${String(id).padStart(4, "0")}`,
      category_id: categoryId,
      unit,
      description: templateIndex % 2 === 0 ? "Asset inventory item" : "Standard stock item",
      status: isActive ? "Active" : "Inactive",
    });
  }

  return [...sampleItems, ...generatedItems];
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

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {label}
    </span>
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

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-300" disabled>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-100"
        >
          1
        </button>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-300" disabled>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const pages: Array<number | "..."> = [];
  const visible = new Set<number>([1, 2, 3, totalPages]);
  if (currentPage > 3) visible.add(currentPage - 1);
  if (currentPage > 1) visible.add(currentPage);
  if (currentPage < totalPages) visible.add(currentPage + 1);

  const sorted = Array.from(visible)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) {
      pages.push("...");
    }
    pages.push(page);
    previous = page;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((page, index) =>
        page === "..." ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-slate-400">
            ...
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onChange(page)}
            className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold transition ${
              currentPage === page
                ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100"
                : "border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {page}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function PopupShell({
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-md",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/15 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
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

function DetailsPopup({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <PopupShell title={title} subtitle={subtitle} onClose={onClose} widthClass="max-w-lg">
      {children}
    </PopupShell>
  );
}

const initialCategories = buildInitialCategories();
const initialItems = buildInitialItems();

function CategoryItems() {
  const location = useLocation();
  const categorySectionRef = useRef<HTMLElement>(null);
  const itemSectionRef = useRef<HTMLElement>(null);

  const [categories, setCategories] = useState<CategoryRecord[]>(initialCategories);
  const [items, setItems] = useState<ItemRecord[]>(initialItems);
  const [categorySearch, setCategorySearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [categoryEditingId, setCategoryEditingId] = useState<number | null>(null);
  const [itemEditingId, setItemEditingId] = useState<number | null>(null);
  const [viewState, setViewState] = useState<ViewState>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    category_name: "",
    description: "",
    status: "Active",
  });
  const [itemForm, setItemForm] = useState<ItemFormState>({
    item_name: "",
    item_code: "",
    category_id: "",
    unit: "Nos",
    description: "",
    status: "Active",
  });

  useEffect(() => {
    if (location.pathname === "/items") {
      itemSectionRef.current?.scrollIntoView({ block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);

  useEffect(() => {
    setCategoryPage(1);
  }, [categorySearch]);

  useEffect(() => {
    setItemPage(1);
  }, [itemSearch]);

  const activeCategoryCount = categories.length;
  const totalItemCount = items.length;
  const activeItemCount = items.filter((item) => item.status === "Active").length;
  const inactiveItemCount = items.filter((item) => item.status === "Inactive").length;
  const statValues = [
    activeCategoryCount.toLocaleString(),
    totalItemCount.toLocaleString(),
    activeItemCount.toLocaleString(),
    inactiveItemCount.toLocaleString(),
  ];

  const filteredCategories = useMemo(() => {
    const needle = categorySearch.trim().toLowerCase();
    return categories.filter((category) => {
      const haystack = `${category.category_name} ${category.description} ${category.status}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [categories, categorySearch]);

  const filteredItems = useMemo(() => {
    const needle = itemSearch.trim().toLowerCase();
    return items.filter((item) => {
      const categoryName = categories.find((category) => category.id === item.category_id)?.category_name ?? "";
      const haystack = `${item.item_name} ${item.item_code} ${item.unit} ${item.description} ${item.status} ${categoryName}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [categories, itemSearch, items]);

  const categoryTotalPages = Math.max(1, Math.ceil(filteredCategories.length / CATEGORY_PAGE_SIZE));
  const itemTotalPages = Math.max(1, Math.ceil(filteredItems.length / ITEM_PAGE_SIZE));

  const categoryPageItems = filteredCategories.slice((categoryPage - 1) * CATEGORY_PAGE_SIZE, categoryPage * CATEGORY_PAGE_SIZE);
  const itemPageItems = filteredItems.slice((itemPage - 1) * ITEM_PAGE_SIZE, itemPage * ITEM_PAGE_SIZE);

  useEffect(() => {
    if (categoryPage > categoryTotalPages) {
      setCategoryPage(categoryTotalPages);
    }
  }, [categoryPage, categoryTotalPages]);

  useEffect(() => {
    if (itemPage > itemTotalPages) {
      setItemPage(itemTotalPages);
    }
  }, [itemPage, itemTotalPages]);

  const openAddCategory = () => {
    setCategoryEditingId(null);
    setCategoryForm({
      category_name: "",
      description: "",
      status: "Active",
    });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (category: CategoryRecord) => {
    setCategoryEditingId(category.id);
    setCategoryForm({
      category_name: category.category_name,
      description: category.description,
      status: category.status,
    });
    setCategoryModalOpen(true);
  };

  const openAddItem = () => {
    setItemEditingId(null);
    setItemForm({
      item_name: "",
      item_code: "",
      category_id: String(categories[0]?.id ?? ""),
      unit: "Nos",
      description: "",
      status: "Active",
    });
    setItemModalOpen(true);
  };

  const openEditItem = (item: ItemRecord) => {
    setItemEditingId(item.id);
    setItemForm({
      item_name: item.item_name,
      item_code: item.item_code,
      category_id: String(item.category_id),
      unit: item.unit,
      description: item.description,
      status: item.status,
    });
    setItemModalOpen(true);
  };

  const saveCategory = () => {
    const nextName = categoryForm.category_name.trim();
    if (!nextName) return;

    if (categoryEditingId === null) {
      const nextId = Math.max(0, ...categories.map((category) => category.id)) + 1;
      setCategories((current) => [
        {
          id: nextId,
          category_name: nextName,
          description: categoryForm.description.trim(),
          total_items: 0,
          status: categoryForm.status,
        },
        ...current,
      ]);
    } else {
      setCategories((current) =>
        current.map((category) =>
          category.id === categoryEditingId
            ? {
                ...category,
                category_name: nextName,
                description: categoryForm.description.trim(),
                status: categoryForm.status,
              }
            : category,
        ),
      );
    }

    setCategoryModalOpen(false);
    setCategoryEditingId(null);
  };

  const saveItem = () => {
    const nextName = itemForm.item_name.trim();
    const nextCode = itemForm.item_code.trim();
    const nextCategoryId = Number(itemForm.category_id);

    if (!nextName || !nextCode || !nextCategoryId) {
      return;
    }

    if (itemEditingId === null) {
      const nextId = Math.max(0, ...items.map((item) => item.id)) + 1;
      setItems((current) => [
        {
          id: nextId,
          item_name: nextName,
          item_code: nextCode,
          category_id: nextCategoryId,
          unit: itemForm.unit,
          description: itemForm.description.trim(),
          status: itemForm.status,
        },
        ...current,
      ]);
    } else {
      setItems((current) =>
        current.map((item) =>
          item.id === itemEditingId
            ? {
                ...item,
                item_name: nextName,
                item_code: nextCode,
                category_id: nextCategoryId,
                unit: itemForm.unit,
                description: itemForm.description.trim(),
                status: itemForm.status,
              }
            : item,
        ),
      );
    }

    setItemModalOpen(false);
    setItemEditingId(null);
  };

  const removeCategory = (categoryId: number) => {
    const confirmed = window.confirm("Delete this category?");
    if (!confirmed) return;
    setCategories((current) => current.filter((category) => category.id !== categoryId));
  };

  const removeItem = (itemId: number) => {
    const confirmed = window.confirm("Delete this item?");
    if (!confirmed) return;
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  const categoryStart = filteredCategories.length === 0 ? 0 : (categoryPage - 1) * CATEGORY_PAGE_SIZE + 1;
  const categoryEnd = Math.min(filteredCategories.length, categoryPage * CATEGORY_PAGE_SIZE);
  const itemStart = filteredItems.length === 0 ? 0 : (itemPage - 1) * ITEM_PAGE_SIZE + 1;
  const itemEnd = Math.min(filteredItems.length, itemPage * ITEM_PAGE_SIZE);

  return (
    <div ref={categorySectionRef} className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        {CATEGORY_STATS.map((stat, index) => (
          <StatCard key={stat.label} value={statValues[index] ?? "0"} {...stat} />
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <SectionHeader
          title="Categories"
          subtitle="Manage all asset categories"
          searchValue={categorySearch}
          searchPlaceholder="Search category..."
          onSearchChange={setCategorySearch}
          actionLabel="Add Category"
          onAction={openAddCategory}
        />

        <div className="px-5 pb-5 pt-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Total Items</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoryPageItems.map((category, index) => {
                  const rowIndex = categoryStart + index;
                  return (
                    <tr key={category.id} className="border-t border-slate-100 text-sm text-slate-700">
                      <td className="px-4 py-4 text-slate-500">{rowIndex}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold ring-1 ring-inset ${CATEGORY_BADGES[(category.id - 1) % CATEGORY_BADGES.length]}`}>
                            {category.category_name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <span className="font-semibold text-slate-900">{category.category_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500">{category.description}</td>
                      <td className="px-4 py-4 font-medium text-slate-700">{category.total_items}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={category.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewState({ type: "category", record: category })}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            aria-label="View category"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCategory(category)}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            aria-label="Edit category"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCategory(category.id)}
                            className="grid h-8 w-8 place-items-center rounded-full text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete category"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <span>
              Showing {categoryStart} to {categoryEnd} of {filteredCategories.length.toLocaleString()} categories
            </span>
            <Pagination currentPage={categoryPage} totalPages={categoryTotalPages} onChange={setCategoryPage} />
          </div>
        </div>
      </section>

      <section ref={itemSectionRef} className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <SectionHeader
          title="Items"
          subtitle="Manage all items under categories"
          searchValue={itemSearch}
          searchPlaceholder="Search item..."
          onSearchChange={setItemSearch}
          actionLabel="Add Item"
          onAction={openAddItem}
          secondaryAction={
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          }
        />

        <div className="px-5 pb-5 pt-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {itemPageItems.map((item, index) => {
                  const rowIndex = itemStart + index;
                  const category = categories.find((entry) => entry.id === item.category_id);
                  const categoryTone = CATEGORY_BADGES[(item.category_id - 1) % CATEGORY_BADGES.length];
                  return (
                    <tr key={item.id} className="border-t border-slate-100 text-sm text-slate-700">
                      <td className="px-4 py-4 text-slate-500">{rowIndex}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{item.item_name}</td>
                      <td className="px-4 py-4 text-slate-500">{item.item_code}</td>
                      <td className="px-4 py-4">
                        <Badge label={category?.category_name || "N/A"} tone={categoryTone} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{item.unit}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewState({ type: "item", record: item })}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            aria-label="View item"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditItem(item)}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            aria-label="Edit item"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="grid h-8 w-8 place-items-center rounded-full text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <span>
              Showing {itemStart} to {itemEnd} of {filteredItems.length.toLocaleString()} items
            </span>
            <Pagination currentPage={itemPage} totalPages={itemTotalPages} onChange={setItemPage} />
          </div>
        </div>
      </section>

      {categoryModalOpen && (
        <PopupShell
          title={categoryEditingId === null ? "Add / Edit Category" : "Add / Edit Category"}
          subtitle="Create or update asset categories"
          onClose={() => setCategoryModalOpen(false)}
          widthClass="max-w-md"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Category Name *</label>
              <input
                type="text"
                value={categoryForm.category_name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, category_name: event.target.value }))}
                placeholder="Enter category name"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Enter description"
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Status *</label>
              <select
                value={categoryForm.status}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, status: event.target.value as Status }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCategory}
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition hover:brightness-110"
              >
                {categoryEditingId === null ? "Save Category" : "Update Category"}
              </button>
            </div>
          </div>
        </PopupShell>
      )}

      {itemModalOpen && (
        <PopupShell
          title={itemEditingId === null ? "Add / Edit Item" : "Add / Edit Item"}
          subtitle="Create or update inventory items"
          onClose={() => setItemModalOpen(false)}
          widthClass="max-w-lg"
        >
          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Item Name *</label>
              <input
                type="text"
                value={itemForm.item_name}
                onChange={(event) => setItemForm((current) => ({ ...current, item_name: event.target.value }))}
                placeholder="Enter item name"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Item Code *</label>
              <input
                type="text"
                value={itemForm.item_code}
                onChange={(event) => setItemForm((current) => ({ ...current, item_code: event.target.value }))}
                placeholder="Enter item code"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category *</label>
                <select
                  value={itemForm.category_id}
                  onChange={(event) => setItemForm((current) => ({ ...current, category_id: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Unit *</label>
                <select
                  value={itemForm.unit}
                  onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400"
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={itemForm.description}
                onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Enter item description"
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Status *</label>
              <select
                value={itemForm.status}
                onChange={(event) => setItemForm((current) => ({ ...current, status: event.target.value as Status }))}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveItem}
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(99,102,241,0.28)] transition hover:brightness-110"
              >
                {itemEditingId === null ? "Save Item" : "Update Item"}
              </button>
            </div>
          </div>
        </PopupShell>
      )}

      {viewState && viewState.type === "category" && (
        <DetailsPopup
          title="Category Details"
          subtitle="View category record"
          onClose={() => setViewState(null)}
        >
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Name</p>
                <p className="mt-1 font-semibold text-slate-900">{viewState.record.category_name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Items</p>
                <p className="mt-1 font-semibold text-slate-900">{viewState.record.total_items}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Status</p>
                <p className="mt-1 font-semibold text-slate-900">{viewState.record.status}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Description</p>
              <p className="mt-1 leading-6 text-slate-700">{viewState.record.description}</p>
            </div>
          </div>
        </DetailsPopup>
      )}

      {viewState && viewState.type === "item" && (
        <DetailsPopup
          title="Item Details"
          subtitle="View item record"
          onClose={() => setViewState(null)}
        >
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Item Name</p>
                <p className="mt-1 font-semibold text-slate-900">{viewState.record.item_name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Item Code</p>
                <p className="mt-1 font-semibold text-slate-900">{viewState.record.item_code}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Category</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {categories.find((category) => category.id === viewState.record.category_id)?.category_name || "N/A"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Unit</p>
                <p className="mt-1 font-semibold text-slate-900">{viewState.record.unit}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Status</p>
              <p className="mt-1 font-semibold text-slate-900">{viewState.record.status}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Description</p>
              <p className="mt-1 leading-6 text-slate-700">{viewState.record.description}</p>
            </div>
          </div>
        </DetailsPopup>
      )}
    </div>
  );
}

export default CategoryItems;

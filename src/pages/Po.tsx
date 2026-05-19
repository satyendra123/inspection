import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import Select from "react-select";
import { FaCalendarAlt } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_API_BASE;
const API_ROOT = (API || "").replace(/\/api\/?$/, "");

const getFileUrl = (filePath: string | null | undefined) => {
  if (!filePath) return "";

  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/^\/+/, "");

  if (normalizedPath.includes("uploads/")) {
    return `${API_ROOT}/api/${normalizedPath}`;
  }

  return `${API_ROOT}/api/uploads/po/${normalizedPath}`;
};

const getFileList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry ?? "").trim())
          .filter(Boolean);
      }
    } catch {
      // legacy single-file path
    }
    return [trimmed];
  }

  return [];
};

const getDisplayName = (filePath: string, fallback: string) => {
  const normalized = String(filePath || "").split("?")[0].split("#")[0];
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || fallback;
};

const mergeFileEntries = (currentValue: any, nextFiles: File[]) => {
  const currentEntries = Array.isArray(currentValue)
    ? currentValue
    : currentValue
      ? [currentValue]
      : [];

  const merged = [...currentEntries];

  nextFiles.forEach((file) => {
    const exists = merged.some((entry: any) => {
      if (entry instanceof File) {
        return (
          entry.name === file.name &&
          entry.size === file.size &&
          entry.lastModified === file.lastModified
        );
      }
      return false;
    });

    if (!exists) {
      merged.push(file);
    }
  });

  return merged;
};

const resolveItemValue = (item: any) =>
  Number(
    item?.item?.value ??
      item?.item?.id ??
      item?.item_id ??
      item?.itemId ??
      0,
  );

const Po = () => {
  const { permissions } = useAuth();
  const [pos, setPos] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [vendor, setVendor] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [itemsList, setItemsList] = useState<any[]>([]);

  const poDateRef = useRef<HTMLInputElement | null>(null);
  const deliveryDateRef = useRef<HTMLInputElement | null>(null);

  const token = localStorage.getItem("token") || "";

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [newPo, setNewPo] = useState<any>({
    id: null,
    po_number: "",
    company: null,
    vendor: null,
    project: null,
    po_date: "",
    delivery_date: "",
    attachment: [],
    design_reference: "",
    design_copy: [],
    status: "active",
    items: [{ item: null, quantity: 0 }],
  });

 const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
  if (!ref.current) return;

  if (typeof (ref.current as any).showPicker === "function") {
    (ref.current as any).showPicker();
  } else {
    ref.current.focus();
    ref.current.click();
  }
};


  /* ================= FETCH ITEMS ================= */
  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API}/items`, axiosConfig);
      setItemsList(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Failed to fetch items", err);
    }
  };

  /* ================= FETCH VENDORS ================= */
  const fetchVendor = async () => {
    try {
      const res = await axios.get(`${API}/vendors`, axiosConfig);
      setVendor(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load vendors");
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(`${API}/companies`, axiosConfig);
      setCompanies(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load companies");
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API}/projects`, axiosConfig);
      setProjects(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load projects");
    }
  };

  useEffect(() => {
    fetchItems();
    fetchVendor();
    fetchCompanies();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPermission = (permission: string) =>
    Array.isArray(permissions) ? permissions.includes(permission) : false;

  const canSelectCompany = hasPermission("view_company");
  const canViewPoItems =
    hasPermission("view_items_po") || hasPermission("viewitems_po");
  const canCreatePo = hasPermission("create_po");
  const canUpdatePo = hasPermission("update_po");
  const canDeletePo = hasPermission("delete_po");

  /* ================= FETCH PO LIST ================= */
  const fetchPo = async () => {
    try {
      const res = await axios.get(`${API}/po-list`, axiosConfig);
      setPos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load PO list");
    }
  };

  useEffect(() => {
    fetchPo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= AUTO CLEAR MSG ================= */
  useEffect(() => {
    if (message || error) {
      const t = setTimeout(() => {
        setMessage("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [message, error]);

  /* ================= INPUT ================= */
  const handleInputChange = (e: any, idx?: number, field?: string) => {
    if (typeof idx === "number" && field) {
      const updatedItems = [...newPo.items];
      updatedItems[idx][field] = e.target.value;
      setNewPo({ ...newPo, items: updatedItems });
    } else {
      setNewPo({ ...newPo, [e.target.name]: e.target.value });
    }
  };

  /* ================= FILE UPLOAD ================= */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const files = Array.from(e.target.files);
      setNewPo((prev: any) => ({
        ...prev,
        [e.target.name]: e.target.multiple
          ? mergeFileEntries(prev[e.target.name], files)
          : files[0],
      }));
      e.target.value = "";
    }
  };

  /* ================= VALIDATION ================= */
  const validatePo = () => {
    if (!newPo.po_number?.trim()) {
      setError("PO Number is required");
      return false;
    }
    if (!newPo.vendor?.value) {
      setError("Vendor is required");
      return false;
    }
    if (canSelectCompany && !newPo.company?.value) {
      setError("Company is required");
      return false;
    }
    if (!newPo.project?.value) {
      setError("Project is required");
      return false;
    }
    if (!newPo.po_date) {
      setError("PO Date is required");
      return false;
    }
    if (!newPo.delivery_date) {
      setError("Delivery Date is required");
      return false;
    }
    if (getFileList(newPo.attachment).length === 0 && !Array.isArray(newPo.attachment)) {
      if (!(newPo.attachment instanceof File)) {
        setError("Attachment is required");
        return false;
      }
    }
    if (
      Array.isArray(newPo.attachment) &&
      newPo.attachment.length === 0
    ) {
      setError("Attachment is required");
      return false;
    }
    if (getFileList(newPo.design_copy).length === 0 && !Array.isArray(newPo.design_copy)) {
      if (!(newPo.design_copy instanceof File)) {
        setError("Design Copy is required");
        return false;
      }
    }
    if (
      Array.isArray(newPo.design_copy) &&
      newPo.design_copy.length === 0
    ) {
      setError("Design Copy is required");
      return false;
    }
    if (!Array.isArray(newPo.items) || newPo.items.length === 0) {
      setError("At least one item is required");
      return false;
    }
    for (let i = 0; i < newPo.items.length; i++) {
      const item = newPo.items[i];
      if (!resolveItemValue(item)) {
        setError(`Select an item for row ${i + 1}`);
        return false;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        setError(`Quantity must be greater than 0 for row ${i + 1}`);
        return false;
      }
    }
    return true;
  };

  /* ================= SAVE ================= */
  const handleSavePo = async () => {
    if (!validatePo()) return;

    try {
      const formData = new FormData();
      formData.append("po_number", newPo.po_number);
      formData.append("vendor", String(newPo.vendor.value));
      if (newPo.company?.value) {
        formData.append("companyIds", JSON.stringify([newPo.company.value]));
        formData.append("company_id", String(newPo.company.value));
      }
      formData.append(
        "existing_attachments",
        JSON.stringify(
          Array.isArray(newPo.attachment)
            ? newPo.attachment.filter((entry: any) => typeof entry === "string")
            : []
        )
      );
      formData.append(
        "existing_design_copies",
        JSON.stringify(
          Array.isArray(newPo.design_copy)
            ? newPo.design_copy.filter((entry: any) => typeof entry === "string")
            : []
        )
      );
      if (newPo.project?.value) {
        formData.append("project_id", String(newPo.project.value));
        formData.append("projectId", String(newPo.project.value));
        formData.append("project_name", newPo.project.label || "");
      }
      formData.append("design_reference", newPo.design_reference || "");
      formData.append("design_ref", newPo.design_reference || "");
      formData.append("designRef", newPo.design_reference || "");
      formData.append("po_date", newPo.po_date);
      formData.append("delivery_date", newPo.delivery_date);
      formData.append("status", newPo.status);

      if (Array.isArray(newPo.attachment)) {
        newPo.attachment.forEach((file: File) => {
          if (file instanceof File) {
            formData.append("attachment", file);
          }
        });
      } else if (newPo.attachment instanceof File) {
        formData.append("attachment", newPo.attachment);
      }
      if (Array.isArray(newPo.design_copy)) {
        newPo.design_copy.forEach((file: File) => {
          if (file instanceof File) {
            formData.append("design_copy", file);
          }
        });
      } else if (newPo.design_copy instanceof File) {
        formData.append("design_copy", newPo.design_copy);
      }

      formData.append(
        "items",
        JSON.stringify(
          newPo.items.map((it: any) => ({
            item_id: it.itemId,
            item: resolveItemValue(it),
            quantity: Number(it.quantity),
          }))
        )
      );

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      };

      if (selectedIndex !== null && newPo.id) {
        await axios.put(`${API}/edit-po/${newPo.id}`, formData, config);
        setMessage("PO updated successfully");
      } else {
        await axios.post(`${API}/create-po`, formData, config);
        setMessage("PO created successfully");
      }

      fetchPo();
      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save PO");
    }
  };

  /* ================= DELETE ================= */
  const handleDeletePo = async () => {
    try {
      const id = pos[selectedIndex!]?.id;
      await axios.delete(`${API}/po-delete/${id}`, axiosConfig);
      setMessage("PO deleted successfully");
      fetchPo();
      setIsDeleteModalOpen(false);
      setSelectedIndex(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete PO");
    }
  };

  function formatDateForInput(date: string | null | undefined) {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  /* ================= EDIT ================= */
  const handleEditPo = (po: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedIndex(index);

    const mappedItems = (po.purchase_order_items || []).map((it: any) => {
      const itemValue = Number(
        it.Item?.id ||
          it.Item?.item_id ||
          it.item?.id ||
          it.item?.item_id ||
          it.item_id ||
          it.itemId ||
          0,
      );
      const fromMaster = itemsList.find((x) => Number(x.id) === itemValue);
      return {
        itemId: it.id,
        item: itemValue
          ? {
              value: itemValue,
              label:
                it.Item?.item_name ||
                it.item?.item_name ||
                it.item_name ||
                fromMaster?.item_name ||
                `Item #${itemValue}`,
              unit_name:
                it.Item?.Unit?.unit_name ||
                it.item?.Unit?.unit_name ||
                fromMaster?.Unit?.unit_name ||
                "",
            }
          : null,
        quantity: it.quantity,
      };
    });

    setNewPo({
      id: po.id,
      po_number: po.po_number,
      vendor: po.Vendor
        ? { value: po.Vendor.id, label: po.Vendor.vendor_name }
        : null,
      company: po.Company
        ? { value: po.Company.id, label: po.Company.company_name || po.Company.name }
        : po.company
        ? { value: po.company.id, label: po.company.company_name || po.company.name }
        : po.company_id && po.company_name
        ? { value: po.company_id, label: po.company_name }
        : null,
      project: po.project_id
        ? { value: po.project_id, label: po.project_name || po.projectName || "" }
        : po.Project?.id
        ? { value: po.Project.id, label: po.Project.project_name }
        : null,
      po_date: formatDateForInput(po.po_date),
      delivery_date: formatDateForInput(po.delivery_date),
      attachment: po.attachments || getFileList(po.attachment),
      design_reference:
        po.design_reference ||
        po.design_refernce ||
        po.design_ref ||
        po.designRef ||
        "",
      design_copy: po.design_copies || getFileList(po.design_copy),
      status: po.status,
      items: mappedItems,
    });
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setSelectedIndex(null);
    setNewPo({
      id: null,
      po_number: "",
      company: null,
      vendor: null,
      project: null,
      po_date: "",
      delivery_date: "",
      attachment: [],
      design_reference: "",
      design_copy: [],
      status: "active",
      items: [],
    });
  };

  // ✅ options with unit_name included
  const itemOptions = itemsList.map((i) => ({
    value: i.id,
    label: i.item_name,
    unit_name: i.Unit?.unit_name || "",
  }));

  const getUnitName = (itemOption: any) => {
    if (!itemOption?.value) return "";
    const found = itemsList.find((x) => x.id === itemOption.value);
    return found?.Unit?.unit_name || "";
  };

  const filteredPos = pos
    .map((po, index) => ({
      po: {
        ...po,
        attachments: getFileList(po.attachments || po.attachment),
        design_copies: getFileList(po.design_copies || po.design_copy),
      },
      index,
    }))
    .filter(({ po }) =>
      JSON.stringify(po).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Alerts */}
      {message && (
        <div className="bg-green-100 text-green-700 p-3 rounded">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">
          <Link to="/po">/PO</Link>
        </h1>
        {canCreatePo && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm"
          >
            Create PO
          </button>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PO number, company, vendor..."
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-100 text-slate-700">
            <tr>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">PO ID</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">PO Number</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Delivery Date</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">PO Date</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Company</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Vendor</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Project</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Design Reference</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Soft Copy</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Design Copy</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Create Date</th>
              {(canUpdatePo ||
                canDeletePo ||
                 canViewPoItems) && (
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide">Action</th>
              )}
            </tr>
            </thead>

            <tbody>
            {filteredPos.map(({ po, index }) => {
              const isAssigned =
                Array.isArray(po.inspections) && po.inspections.length > 0;

              return (
                <tr key={po.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                  <td className="p-3 text-sm text-slate-700">{po.id}</td>
                  <td className="p-3 text-sm font-medium text-slate-800">{po.po_number}</td>
                  <td className="p-3 text-sm text-slate-700">{po.delivery_date}</td>
                  <td className="p-3 text-sm text-slate-700">{po.po_date}</td>
                  <td className="p-3 text-sm text-slate-700">
                    {po.Company?.company_name || po.company?.company_name || po.company_name || "-"}
                  </td>
                  <td className="p-3 text-sm text-slate-700">{po.Vendor?.vendor_name || "-"}</td>
                  <td className="p-3 text-sm text-slate-700">{po.project_name || po.projectName || "-"}</td>
                  <td className="p-3 text-sm text-slate-700">
                    {po.design_reference || po.design_refernce || po.design_ref || po.designRef || "-"}
                  </td>

                  <td className="p-3 text-sm">
                    {po.attachments.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {po.attachments.map((file, fileIndex) => (
                          <a
                            key={`${po.id}-attachment-${fileIndex}`}
                            href={getFileUrl(file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                            title={getDisplayName(file, `Soft Copy ${fileIndex + 1}`)}
                          >
                            {`View ${fileIndex + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="p-3 text-sm">
                    {po.design_copies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {po.design_copies.map((file, fileIndex) => (
                          <a
                            key={`${po.id}-design-${fileIndex}`}
                            href={getFileUrl(file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                            title={getDisplayName(file, `Design Copy ${fileIndex + 1}`)}
                          >
                            {`View ${fileIndex + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="p-3 text-sm text-slate-700">{po.createdAt}</td>

                  <td
                    className={`p-3 flex gap-2 items-center ${
                      isAssigned ? "justify-center" : "justify-start"
                    }`}
                  >
                 
                    {canUpdatePo && !isAssigned && (
                      <button
                        onClick={() => handleEditPo(po, index)}
                        className="h-9 w-9 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center"
                        title="Edit PO"
                      >
                        <EditIcon />
                      </button>
                    )}

                    {canDeletePo && !isAssigned && (
                      <button
                        onClick={() => {
                          setIsDeleteModalOpen(true);
                          setSelectedIndex(index);
                        }}
                        className="h-9 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center"
                        title="Delete PO"
                      >
                        <DeleteIcon />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] overflow-y-auto flex items-start justify-center z-50 p-4 md:py-8">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-700 text-white sticky top-0 z-10">
              <h2 className="text-xl font-semibold">
                {selectedIndex !== null ? "Edit Purchase Order" : "Create Purchase Order"}
              </h2>
              <p className="text-sm text-slate-200 mt-1">
                Fill core details, items and supporting files.
              </p>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg border border-red-200">{error}</div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Core Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">PO Number</label>
                    <input
                      className="border border-slate-300 p-2.5 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                      name="po_number"
                      placeholder="PO Number"
                      value={newPo.po_number}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">Company Name</label>
                    <Select
                      options={companies.map((c) => ({
                        value: c.id,
                        label: c.company_name || c.name,
                      }))}
                      value={newPo.company || null}
                      onChange={(selected: any) =>
                        setNewPo({ ...newPo, company: selected, project: null })
                      }
                      placeholder="Select Company"
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">Vendor</label>
                    <Select
                      options={vendor.map((v) => ({
                        value: v.id,
                        label: v.vendor_name,
                      }))}
                      value={newPo.vendor || null}
                      onChange={(selected: any) =>
                        setNewPo({ ...newPo, vendor: selected })
                      }
                      placeholder="Select Vendor"
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">Project</label>
                    <Select
                      options={projects
                        .filter((p) =>
                          newPo.company?.value ? Number(p.company_id) === Number(newPo.company.value) : true
                        )
                        .map((p) => ({
                          value: p.id,
                          label: p.project_name,
                        }))}
                      value={newPo.project || null}
                      onChange={(selected: any) =>
                        setNewPo({ ...newPo, project: selected })
                      }
                      placeholder="Select Project"
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">Design Reference</label>
                    <input
                      className="border border-slate-300 p-2.5 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                      name="design_reference"
                      placeholder="Enter design reference details"
                      value={newPo.design_reference}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">PO Date</label>
                    <div className="relative">
                      <input
                        ref={poDateRef}
                        type="date"
                        className="border border-slate-300 p-2.5 w-full pr-10 cursor-pointer rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                        name="po_date"
                        value={newPo.po_date}
                        onChange={handleInputChange}
                      />
                      <span
                        onClick={() => openDatePicker(poDateRef)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer"
                        aria-label="Open PO date"
                        title="Open calendar"
                      >
                        <FaCalendarAlt />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1 text-slate-700">Delivery Date</label>
                    <div className="relative">
                      <input
                        ref={deliveryDateRef}
                        type="date"
                        className="border border-slate-300 p-2.5 w-full pr-10 cursor-pointer rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                        name="delivery_date"
                        value={newPo.delivery_date}
                        onChange={handleInputChange}
                      />
                      <span
                        onClick={() => openDatePicker(deliveryDateRef)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer"
                        aria-label="Open delivery date"
                        title="Open calendar"
                      >
                        <FaCalendarAlt />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Items</h3>
                  <button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm"
                    onClick={() =>
                      setNewPo({
                        ...newPo,
                        items: [...newPo.items, { item: null, quantity: 0 }],
                      })
                    }
                  >
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {newPo.items.map((item: any, idx: number) => {
                    const unit =
                      item?.item?.unit_name || getUnitName(item?.item) || "";

                    return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-7">
                          <Select
                            options={itemOptions}
                            value={item.item || null}
                            onChange={(selected: any) => {
                              const updatedItems = [...newPo.items];
                              updatedItems[idx].item = selected;
                              setNewPo({ ...newPo, items: updatedItems });
                            }}
                            placeholder="Select Item"
                            isSearchable
                            className="w-full"
                          />
                        </div>

                        <div className="md:col-span-4 flex items-center">
                          <input
                            type="number"
                            className="border border-slate-300 p-2.5 w-full rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handleInputChange(e, idx, "quantity")}
                          />
                          <span className="border border-l-0 border-slate-300 p-2.5 bg-white text-slate-700 rounded-r-lg min-w-[72px] text-center">
                            {unit || "-"}
                          </span>
                        </div>

                        <div className="md:col-span-1">
                          <button
                            type="button"
                            className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-2.5 rounded-lg text-sm"
                            onClick={() => {
                              const updatedItems = [...newPo.items];
                              updatedItems.splice(idx, 1);
                              setNewPo({ ...newPo, items: updatedItems });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Attachments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Soft Copy</label>
                    <input
                      type="file"
                      name="attachment"
                      accept=".pdf,image/*"
                      multiple
                      onChange={handleFileChange}
                      className="border border-slate-300 p-2.5 w-full rounded-lg bg-white"
                    />
                    {Array.isArray(newPo.attachment) && newPo.attachment.length > 0 && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                        {newPo.attachment.every((file: any) => file instanceof File) ? (
                          <div className="flex flex-wrap gap-2">
                            {newPo.attachment.map((file: File, fileIndex: number) => (
                              <span
                                key={`${file.name}-${fileIndex}`}
                                className="rounded bg-slate-100 px-2 py-1 text-slate-700"
                              >
                                {file.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {getFileList(newPo.attachment).map((file, fileIndex) => (
                              <a
                                key={`${file}-${fileIndex}`}
                                href={getFileUrl(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-blue-600 hover:underline"
                              >
                                {`View Soft Copy ${fileIndex + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-slate-700">Design Copy</label>
                    <input
                      type="file"
                      name="design_copy"
                      accept=".pdf,image/*"
                      multiple
                      onChange={handleFileChange}
                      className="border border-slate-300 p-2.5 w-full rounded-lg bg-white"
                    />
                    {Array.isArray(newPo.design_copy) && newPo.design_copy.length > 0 && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                        {newPo.design_copy.every((file: any) => file instanceof File) ? (
                          <div className="flex flex-wrap gap-2">
                            {newPo.design_copy.map((file: File, fileIndex: number) => (
                              <span
                                key={`${file.name}-${fileIndex}`}
                                className="rounded bg-slate-100 px-2 py-1 text-slate-700"
                              >
                                {file.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {getFileList(newPo.design_copy).map((file, fileIndex) => (
                              <a
                                key={`${file}-${fileIndex}`}
                                href={getFileUrl(file)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-blue-600 hover:underline"
                              >
                                {`View Design Copy ${fileIndex + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={closeModal}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-medium"
              >
                {selectedIndex !== null ? "Update PO" : "Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePo}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Po;

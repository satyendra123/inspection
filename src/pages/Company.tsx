import { useEffect, useState } from "react";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link, useNavigate } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";
import { api } from "../utils/apiClient";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8060/api";
const API_ROOT = (API || "").replace(/\/api\/?$/, "");

const getCompaniesFromResponse = (payload: any) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.companies)) return payload.companies;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const getLogoUrl = (logo: string | null | undefined) => {
  if (!logo) return "";
  if (/^https?:\/\//i.test(logo)) return logo;
  const normalized = String(logo).replace(/^\/+/, "");
  return `${API_ROOT}/${normalized}`;
};

const Company = () => {
  const navigate = useNavigate();
  const canViewCompany = checkPermission("view_company");
  const canCreateCompany = checkPermission("create_company");
  const canUpdateCompany = checkPermission("update_company");
  const canDeleteCompany = checkPermission("delete_company");

  const [companies, setCompanies] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");

  const [newCompany, setNewCompany] = useState<any>({
    id: null,
    company_name: "",
    registered_address: "",
    city: "",
    state: "",
    pin: "",
    cin_no: "",
    gstin_no: "",
    contact_no: "",
    email_id: "",
    website: "",
    logo: null,
    status: "active",
  });

  const multipartConfig = {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  };

  const handleApiError = (err: any, fallback: string) => {
    const status = err?.response?.status;
    const message = err?.response?.data?.message || err?.response?.data?.msg || fallback;
    if (status === 401) {
      localStorage.removeItem("token");
      setError(`${message}. Please sign in again.`);
      navigate("/login", { replace: true });
      return;
    }
    setError(message);
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies");
      setCompanies(getCompaniesFromResponse(res.data));
    } catch (err: any) {
      console.error(err);
      handleApiError(err, "Failed to load companies");
    }
  };

  useEffect(() => {
    if (!canViewCompany) return;
    fetchCompanies();
  }, [canViewCompany]);

  useEffect(() => {
    if (message || error) {
      const t = setTimeout(() => {
        setMessage("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [message, error]);

  useEffect(() => {
    if (!newCompany.logo) {
      setLogoPreviewUrl("");
      return;
    }

    if (typeof newCompany.logo === "string") {
      setLogoPreviewUrl(getLogoUrl(newCompany.logo));
      return;
    }

    const objectUrl = URL.createObjectURL(newCompany.logo);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [newCompany.logo]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setNewCompany({ ...newCompany, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setNewCompany({ ...newCompany, [e.target.name]: e.target.files[0] });
    }
  };

  const validateCompany = () => {
    if (!newCompany.company_name?.trim()) {
      setError("Name of Company is required");
      return false;
    }
    return true;
  };

  const toFormData = () => {
    const formData = new FormData();
    formData.append("company_name", newCompany.company_name || "");
    formData.append("registered_address", newCompany.registered_address || "");
    formData.append("city", newCompany.city || "");
    formData.append("state", newCompany.state || "");
    formData.append("pin", newCompany.pin || "");
    formData.append("cin_no", newCompany.cin_no || "");
    formData.append("gstin_no", newCompany.gstin_no || "");
    formData.append("contact_no", newCompany.contact_no || "");
    formData.append("email_id", newCompany.email_id || "");
    formData.append("website", newCompany.website || "");
    formData.append("status", newCompany.status || "active");
    if (newCompany.logo instanceof File) {
      formData.append("logo", newCompany.logo);
    }
    return formData;
  };

  const handleSaveCompany = async () => {
    try {
      if (!validateCompany()) return;
      const isEdit = selectedCompanyIndex !== null;
      if (isEdit && !canUpdateCompany) {
        setError("You do not have permission to update company");
        return;
      }
      if (!isEdit && !canCreateCompany) {
        setError("You do not have permission to create company");
        return;
      }
      const formData = toFormData();

      if (isEdit) {
        await api.put(`/companies/${newCompany.id}`, formData, multipartConfig);
        setMessage("Company updated successfully");
      } else {
        await api.post("/companies", formData, multipartConfig);
        setMessage("Company added successfully");
      }
      setSearchTerm("");
      await fetchCompanies();
      closeEditModal();
    } catch (err: any) {
      console.error(err);
      handleApiError(err, "Failed to save company");
    }
  };

  const handleDeleteCompany = async () => {
    try {
      if (!canDeleteCompany) {
        setError("You do not have permission to delete company");
        return;
      }
      const companyId = companies[selectedCompanyIndex!]?.id;
      await api.delete(`/companies/${companyId}`);
      setMessage("Company deleted successfully");
      await fetchCompanies();
      setIsDeleteModalOpen(false);
      setSelectedCompanyIndex(null);
    } catch (err: any) {
      console.error(err);
      handleApiError(err, "Failed to delete company");
    }
  };

  const handleEditCompany = (company: any, index: number) => {
    if (!canUpdateCompany) {
      setError("You do not have permission to edit company");
      return;
    }
    setIsEditModalOpen(true);
    setSelectedCompanyIndex(index);
    setNewCompany({
      id: company.id,
      company_name: company.company_name || company.name_of_company || company.name || "",
      registered_address: company.registered_address || company.address || "",
      city: company.city || "",
      state: company.state || "",
      pin: company.pin || "",
      cin_no: company.cin_no || "",
      gstin_no: company.gstin_no || "",
      contact_no: company.contact_no || company.mobile_no || "",
      email_id: company.email_id || company.email || "",
      website: company.website || "",
      logo: company.logo || null,
      status: company.status || "active",
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCompanyIndex(null);
    setNewCompany({
      id: null,
      company_name: "",
      registered_address: "",
      city: "",
      state: "",
      pin: "",
      cin_no: "",
      gstin_no: "",
      contact_no: "",
      email_id: "",
      website: "",
      logo: null,
      status: "active",
    });
  };

  const filteredCompanies = companies
    .map((company, index) => ({ company, index }))
    .filter(({ company }) =>
      JSON.stringify(company).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  const activeCompanies = companies.filter(
    (company) => (company?.status || "").toLowerCase() === "active",
  ).length;
  const inactiveCompanies = companies.length - activeCompanies;
  const canManageCompany = canUpdateCompany || canDeleteCompany;
  const canSaveCurrentCompany =
    selectedCompanyIndex !== null ? canUpdateCompany : canCreateCompany;

  if (!canViewCompany) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        You do not have permission to view company module.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 overflow-x-auto pb-4">
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Enterprise Master</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-800">
              <Link to="/company" className="hover:text-slate-600">
                Company Management
              </Link>
            </h1>
            <p className="mt-1 text-sm text-slate-500">Manage company profile, compliance and contact details.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                Total: {companies.length}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                Active: {activeCompanies}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                Inactive: {inactiveCompanies}
              </span>
            </div>
          </div>
          {canCreateCompany && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-700"
            >
              + Add Company
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-slate-800">Company List ({filteredCompanies.length})</h2>
          <div className="w-full md:w-[340px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, city, GSTIN, email..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none ring-0 transition focus:border-slate-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="max-h-[calc(100vh-300px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-700">
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Name of Company</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Registered Address</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">City</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">State</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Pin</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">CIN no</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">GSTIN no</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Contact no</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Email id</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Website</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Logo</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Status</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredCompanies.map(({ company, index }) => (
                <tr
                  key={company.id}
                  className={`border-b border-slate-100 transition hover:bg-sky-50/60 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                >
                  <td className="max-w-[220px] truncate px-4 py-3 font-semibold text-slate-800" title={company.name_of_company || company.company_name || company.name || "-"}>
                    {company.name_of_company || company.company_name || company.name || "-"}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-slate-700" title={company.registered_address || company.address || "-"}>
                    {company.registered_address || company.address || "-"}
                  </td>
                  <td className="max-w-[130px] truncate px-4 py-3 text-slate-700" title={company.city || "-"}>{company.city || "-"}</td>
                  <td className="max-w-[130px] truncate px-4 py-3 text-slate-700" title={company.state || "-"}>{company.state || "-"}</td>
                  <td className="max-w-[120px] truncate px-4 py-3 text-slate-700" title={company.pin || "-"}>{company.pin || "-"}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-700" title={company.cin_no || "-"}>{company.cin_no || "-"}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-slate-700" title={company.gstin_no || "-"}>{company.gstin_no || "-"}</td>
                  <td className="max-w-[150px] truncate px-4 py-3 text-slate-700" title={company.contact_no || company.mobile_no || "-"}>
                    {company.contact_no || company.mobile_no || "-"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={company.email_id || company.email || "-"}>
                    {company.email_id || company.email || "-"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={company.website || "-"}>{company.website || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {company.logo ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={getLogoUrl(company.logo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                          title="View logo"
                        >
                          <img
                            src={getLogoUrl(company.logo)}
                            alt={`${company.company_name || company.name || "Company"} logo`}
                            className="h-full w-full object-contain"
                          />
                        </a>
                        <a
                          href={getLogoUrl(company.logo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200"
                        >
                          View
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No logo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        (company.status || "").toLowerCase() === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {company.status || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManageCompany ? (
                      <div className="flex items-center gap-2">
                        {canUpdateCompany && (
                          <button
                            onClick={() => handleEditCompany(company, index)}
                            className="rounded-lg bg-indigo-50 p-2 text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800"
                          >
                            <EditIcon />
                          </button>
                        )}
                        {canDeleteCompany && (
                          <button
                            onClick={() => {
                              setIsDeleteModalOpen(true);
                              setSelectedCompanyIndex(index);
                            }}
                            className="rounded-lg bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
                          >
                            <DeleteIcon />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">--</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredCompanies.length && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                    No company data found for this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[92vh]">
            <h2 className="mb-1 text-xl font-bold text-slate-800">
              {selectedCompanyIndex !== null ? "Edit Company" : "Add New Company"}
            </h2>
            <p className="mb-5 text-sm text-slate-500">Update company details and compliance information.</p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Name of Company</label>
                <input
                  type="text"
                  name="company_name"
                  value={newCompany.company_name}
                  onChange={handleInputChange}
                  placeholder="Name of Company"
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">CIN no</label>
                <input type="text" name="cin_no" value={newCompany.cin_no} onChange={handleInputChange} placeholder="CIN no" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">GSTIN no</label>
                <input type="text" name="gstin_no" value={newCompany.gstin_no} onChange={handleInputChange} placeholder="GSTIN no" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Contact no</label>
                <input type="text" name="contact_no" value={newCompany.contact_no} onChange={handleInputChange} placeholder="Contact no" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Email id</label>
                <input type="email" name="email_id" value={newCompany.email_id} onChange={handleInputChange} placeholder="Email id" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Website</label>
                <input type="text" name="website" value={newCompany.website} onChange={handleInputChange} placeholder="Website" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">City</label>
                <input type="text" name="city" value={newCompany.city} onChange={handleInputChange} placeholder="City" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">State</label>
                <input type="text" name="state" value={newCompany.state} onChange={handleInputChange} placeholder="State" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Pin</label>
                <input type="text" name="pin" value={newCompany.pin} onChange={handleInputChange} placeholder="Pin" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-700">Status</label>
                <select
                  name="status"
                  value={newCompany.status}
                  onChange={handleInputChange}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Logo</label>
                <input type="file" name="logo" onChange={handleFileChange} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" />
                {newCompany.logo && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {!!logoPreviewUrl && (
                      <img
                        src={logoPreviewUrl}
                        alt="Company logo preview"
                        className="h-10 w-10 rounded-md border border-slate-200 bg-white object-contain sm:h-12 sm:w-12 lg:h-14 lg:w-14"
                      />
                    )}
                    <span className="text-xs font-medium text-slate-600">
                      {typeof newCompany.logo === "string" ? "Current logo" : newCompany.logo?.name || "Selected logo"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">Registered Address</label>
                <textarea
                  name="registered_address"
                  value={newCompany.registered_address}
                  onChange={handleInputChange}
                  placeholder="Registered Address"
                  className="min-h-24 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-slate-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeEditModal} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              {canSaveCurrentCompany && (
                <button onClick={handleSaveCompany} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                  {selectedCompanyIndex !== null ? "Update" : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && canDeleteCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-xl font-bold text-slate-800">Confirm Delete</h2>
            <p className="mb-5 text-sm text-slate-500">This action will permanently remove the selected company.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={handleDeleteCompany} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Company;

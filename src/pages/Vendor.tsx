import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;

const Vendor = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedVendorIndex, setSelectedVendorIndex] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newVendor, setNewVendor] = useState<any>({
    id: null,
    vendor_name: "",
    Contact_person: "",
    email: "",
    mobile_no: "",
    address: "",
    status: "active",
  });

  const token =
    localStorage.getItem("token") || "";
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  // Fetch vendors
  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API}/vendors`, axiosConfig);
      setVendors(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load vendors");
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Auto clear messages
  useEffect(() => {
    if (message || error) {
      const t = setTimeout(() => {
        setMessage("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [message, error]);

  // Input change handler
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setNewVendor({ ...newVendor, [e.target.name]: e.target.value });
  };
const validateVendor = () => {
    if (!newVendor.vendor_name.trim()) {
      setError("Vendor Name is required");
      return false;
    }
    if (!newVendor.Contact_person.trim()) {
      setError("Contact Person is required");
      return false;
    }
    if (!newVendor.email.trim()) {
      setError("Email is required");
      return false;
    }
    // basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newVendor.email)) {
      setError("Enter a valid email");
      return false;
    }
    if (!newVendor.mobile_no.trim()) {
      setError("Mobile No is required");
      return false;
    }
    if (!/^\d+$/.test(newVendor.mobile_no)) {
      setError("Mobile No must be numeric");
      return false;
    }
    return true;
  };

  // Save (Add/Update) vendor
  const handleSaveVendor = async () => {
    try {
          if (!validateVendor()) return;

      if (selectedVendorIndex !== null) {
        await axios.put(`${API}/vendors/${newVendor.id}`, newVendor, axiosConfig);
        setMessage("Vendor updated successfully");
      } else {
        await axios.post(`${API}/vendors`, newVendor, axiosConfig);
        setMessage("Vendor added successfully");
      }
      fetchVendors();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError("Failed to save vendor");
    }
  };

  // Delete vendor
  const handleDeleteVendor = async () => {
    try {
      const vendorId = vendors[selectedVendorIndex!]?.id;
      await axios.delete(`${API}/vendors/${vendorId}`, axiosConfig);
      setMessage("Vendor deleted successfully");
      fetchVendors();
      setIsDeleteModalOpen(false);
      setSelectedVendorIndex(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete vendor");
    }
  };

  // Edit vendor
  const handleEditVendor = (vendor: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedVendorIndex(index);
    setNewVendor({
      id: vendor.id,
      vendor_name: vendor.vendor_name || "",
      Contact_person: vendor.Contact_person || "",
      email: vendor.email || "",
      mobile_no: vendor.mobile_no || "",
      address: vendor.address || "",
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedVendorIndex(null);
    setNewVendor({
      id: null,
      vendor_name: "",
      Contact_person: "",
      email: "",
      mobile_no: "",
      address: "",
    });
  };

  const filteredVendors = vendors
    .map((vendor, index) => ({ vendor, index }))
    .filter(({ vendor }) =>
      JSON.stringify(vendor).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Alerts */}
      {message && <div className="bg-green-100 border text-green-700 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-2">
          <Link to="/vendors">
            <span className="hover:text-blue-800">/Vendors</span>
          </Link>
        </h1>
        {checkPermission("create_vendor") && (
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          Add Vendor
        </button>
        )}  
      </div>

      {/* Vendors Table */}
      <div className="overflow-x-auto p-4">
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vendor..."
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Vendor Name</th>
              <th className="p-3">Contact Person</th>
              <th className="p-3">Email</th>
              <th className="p-3">Mobile No</th>
              <th className="p-3">Address</th>
              <th className="p-3">Status</th>
              {(checkPermission("update_vendor") || checkPermission("delete_vendor")) && (
              <th className="p-3">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.isArray(filteredVendors) &&
              filteredVendors.map(({ vendor, index }) => (
                <tr key={vendor.id} className={`border-b ${index % 2 === 0 ? "bg-yellow-50" : "bg-white"}`}>
                  <td className="p-3">{vendor.vendor_name}</td>
                  <td className="p-3">{vendor.Contact_person}</td>
                  <td className="p-3">{vendor.email}</td>
                  <td className="p-3">{vendor.mobile_no}</td>
                  <td className="p-3">{vendor.address}</td>
                  <td className="p-3">{vendor.status}</td>
                  <td className="p-3 flex gap-3">
                  {checkPermission("update_vendor") && (
                    <button
                      onClick={() => handleEditVendor(vendor, index)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <EditIcon />
                    </button>
                  )}
                  {checkPermission("delete_vendor") && (
                    <button
                      onClick={() => {
                        setIsDeleteModalOpen(true);
                        setSelectedVendorIndex(index);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <DeleteIcon />
                    </button>
                  )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {selectedVendorIndex !== null ? "Edit Vendor" : "Add New Vendor"}
            </h2>
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                name="vendor_name"
                value={newVendor.vendor_name}
                onChange={handleInputChange}
                placeholder="Vendor Name"
                className="border p-2 rounded"
              />
              <input
                type="text"
                name="Contact_person"
                value={newVendor.Contact_person}
                onChange={handleInputChange}
                placeholder="Contact Person"
                className="border p-2 rounded"
              />
              <input
                type="email"
                name="email"
                value={newVendor.email}
                onChange={handleInputChange}
                placeholder="Email"
                className="border p-2 rounded"
              />
              <input
                type="text"
                name="mobile_no"
                value={newVendor.mobile_no}
                onChange={handleInputChange}
                placeholder="Mobile No"
                className="border p-2 rounded"
              />
              <textarea
                name="address"
                value={newVendor.address}
                onChange={handleInputChange}
                placeholder="Address"
                className="border p-2 rounded"
              />
            </div>

            <div className="flex justify-end mt-6 gap-4">
              <button onClick={closeEditModal} className="bg-gray-600 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleSaveVendor} className="bg-green-600 text-white px-4 py-2 rounded">
                {selectedVendorIndex !== null ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl mb-4 font-bold">Confirm Delete</h2>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleDeleteVendor} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendor;

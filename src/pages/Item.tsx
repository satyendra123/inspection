import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";
import Select from "react-select";

const API = import.meta.env.VITE_API_BASE;

const Item = () => {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newItem, setNewItem] = useState<any>({
    id: null,
    item_name: "",
    Category_id: "",
    unit_id: "",
    description: "",
    status: "active",
  });

  const token = localStorage.getItem("token") || "";
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  // Fetch Items
  const fetchItems = async () => {
    try {
      const res = await axios.get(`${API}/items`, axiosConfig);
      setItems(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load items");
    }
  };

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`, axiosConfig);
      setCategories(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load categories");
    }
  };

  // Fetch Units
  const fetchUnits = async () => {
    try {
      const res = await axios.get(`${API}/units`, axiosConfig);
      setUnits(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load units");
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchUnits();
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

  // Input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  };

  // Save (Add/Update) item with validation
  const handleSaveItem = async () => {
    // Validation
    if (!newItem.item_name.trim()) {
      setError("Item Name is required");
      return;
    }
    if (!newItem.Category_id) {
      setError("Category is required");
      return;
    }
    if (!newItem.unit_id) {
      setError("Unit is required");
      return;
    }

    try {
      if (selectedCategoryIndex !== null) {
        await axios.put(`${API}/items/${newItem.id}`, newItem, axiosConfig);
        setMessage("Item updated successfully");
      } else {
        await axios.post(`${API}/items`, newItem, axiosConfig);
        setMessage("Item added successfully");
      }
      fetchItems();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError("Failed to save item");
    }
  };

  // Delete item
  const handleDeleteItem = async () => {
    try {
      const itemId = items[selectedCategoryIndex!]?.id;
      await axios.delete(`${API}/items/${itemId}`, axiosConfig);
      setMessage("Item deleted successfully");
      fetchItems();
      setIsDeleteModalOpen(false);
      setSelectedCategoryIndex(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete item");
    }
  };

  // Edit item
  const handleEditItem = (item: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedCategoryIndex(index);
    setNewItem({
      id: item.id,
      item_name: item.item_name || "",
      Category_id: item.Category_id || "",
      unit_id: item.unit_id || "",
      description: item.description || "",
      status: item.status || "active",
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCategoryIndex(null);
    setNewItem({
      id: null,
      item_name: "",
      Category_id: "",
      unit_id: "",
      description: "",
      status: "active",
    });
  };

  const filteredItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Alerts */}
      {message && <div className="bg-green-100 border text-green-700 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-2">
          <Link to="/items">
            <span className="hover:text-blue-800">/Items</span>
          </Link>
        </h1>
        {checkPermission("create_item") && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            Add Item
          </button>
        )}
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto p-4">
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search item..."
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Item Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Unit</th>
              <th className="p-3">Description</th>
              <th className="p-3">Status</th>
              {(checkPermission("update_item") || checkPermission("delete_item")) && (
                <th className="p-3">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.isArray(filteredItems) &&
              filteredItems.map(({ item, index }) => (
                <tr key={item.id} className={`border-b ${index % 2 === 0 ? "bg-yellow-50" : "bg-white"}`}>
                  <td className="p-3">{item.item_name}</td>
                  <td className="p-3">{item.Category?.category_name || "N/A"}</td>
                  <td className="p-3">{item.Unit?.unit_name || "-"}</td>
                  <td className="p-3">{item.description}</td>
                  <td className="p-3">{item.status}</td>
                  {(checkPermission("update_item") || checkPermission("delete_item")) && (
                    <td className="p-3 flex justify-center items-center gap-3">
                      {checkPermission("update_item") && (
                        <button onClick={() => handleEditItem(item, index)} className="text-blue-500 hover:text-blue-700">
                          <EditIcon />
                        </button>
                      )}
                      {checkPermission("delete_item") && (
                        <button
                          onClick={() => {
                            setIsDeleteModalOpen(true);
                            setSelectedCategoryIndex(index);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <DeleteIcon />
                        </button>
                      )}
                    </td>
                  )}
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
              {selectedCategoryIndex !== null ? "Edit Item" : "Add New Item"}
            </h2>
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                name="item_name"
                value={newItem.item_name}
                onChange={handleInputChange}
                placeholder="Item Name"
                className="border p-2 rounded"
              />

              <Select
                options={categories.map((c) => ({
                  value: String(c.id),
                  label: c.category_name,
                }))}
                value={
                  categories
                    .map((c) => ({ value: String(c.id), label: c.category_name }))
                    .find((c) => c.value === String(newItem.Category_id)) || null
                }
                onChange={(selected) =>
                  setNewItem({ ...newItem, Category_id: selected?.value || "" })
                }
                placeholder="Select Category"
                isSearchable
              />

              <Select
                options={units.map((u) => ({
                  value: String(u.id),
                  label: u.unit_name,
                }))}
                value={
                  units
                    .map((u) => ({ value: String(u.id), label: u.unit_name }))
                    .find((u) => u.value === String(newItem.unit_id)) || null
                }
                onChange={(selected) =>
                  setNewItem({ ...newItem, unit_id: selected?.value || "" })
                }
                placeholder="Select Unit"
                isSearchable
              />

              <textarea
                name="description"
                value={newItem.description}
                onChange={handleInputChange}
                placeholder="Description"
                className="border p-2 rounded"
              />
            </div>

            <div className="flex justify-end mt-6 gap-4">
              <button onClick={closeEditModal} className="bg-gray-600 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleSaveItem} className="bg-green-600 text-white px-4 py-2 rounded">
                {selectedCategoryIndex !== null ? "Update" : "Save"}
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
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button onClick={handleDeleteItem} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Item;

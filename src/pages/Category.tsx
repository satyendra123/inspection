import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";
const API = import.meta.env.VITE_API_BASE;

const Category = () => {
  const [categories, setCategories] = useState<any[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newCategory, setNewCategory] = useState<any>({
    id: null,
    category_name: "",
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
  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`, axiosConfig);
      setCategories(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load categories");
    }
  };

  useEffect(() => {
    fetchCategories();
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewCategory({ ...newCategory, [e.target.name]: e.target.value });
  };
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewCategory({ ...newCategory, [e.target.name]: e.target.value });
  };

  // Save (Add/Update) category
  const handleSaveCategory = async () => {
    try {
      if (selectedCategoryIndex !== null) {
        // Update
        await axios.put(`${API}/categories/${newCategory.id}`, newCategory, axiosConfig);
        setMessage("Category updated successfully");
      } else {
        // Create
        await axios.post(`${API}/categories`, newCategory, axiosConfig);
        setMessage("Category added successfully");
      }
      fetchCategories();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError("Failed to save category");
    }
  };

  // Delete category
  const handleDeleteCategory = async () => {
    try {
      const categoryId = categories[selectedCategoryIndex!]?.id;
      await axios.delete(`${API}/categories/${categoryId}`, axiosConfig);
      setMessage("Category deleted successfully");
      fetchCategories();
      setIsDeleteModalOpen(false);
      setSelectedCategoryIndex(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete category");
    }
  };

  // Edit category
  const handleEditCategory = (category: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedCategoryIndex(index);
    setNewCategory({
      id: category.id,
      category_name: category.category_name || "",
      description: category.description || "",
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCategoryIndex(null);
    setNewCategory({
      id: null,
      category_name: "",
      description: "",
    });
  };

  const filteredCategories = categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) =>
      JSON.stringify(category).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Alerts */}
      {message && <div className="bg-green-100 border text-green-700 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-2">
          <Link to="/categorys">
            <span className="hover:text-blue-800">/Categories</span>
          </Link>
        </h1>
        {checkPermission("create_category") && (

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            Add Category
          </button>
        )}
      </div>

      {/* Categories Table */}
      <div className="overflow-x-auto p-4">
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search category..."
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Category Name</th>
              <th className="p-3">Description</th>
              <th className="p-3">Status</th>
              {(checkPermission("update_category") || checkPermission("delete_category")) && (
                <th className="p-3">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.isArray(filteredCategories) &&
              filteredCategories.map(({ category: c, index }) => (
                <tr key={c.id} className={`border-b ${index % 2 === 0 ? "bg-yellow-50" : "bg-white"} m-5 p-5`}>
                  <td className="p-3">{c.category_name}</td>
                  <td className="p-3">{c.description}</td>
                  <td className="p-3">{c.status}</td>
                  <td className="p-3 flex gap-3">
                    {checkPermission("update_category") && (

                      <button onClick={() => handleEditCategory(c, index)} className="text-blue-500 hover:text-blue-700">
                        <EditIcon />
                      </button>
                    )}         {checkPermission("delete_category") && (
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
              {selectedCategoryIndex !== null ? "Edit Category" : "Add New Category"}
            </h2>
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                name="category_name"
                value={newCategory.category_name}
                onChange={handleInputChange}
                placeholder="Category Name"
                className="border p-2 rounded"
              />
              <textarea
                name="description"
                value={newCategory.description}
                onChange={handleInputChange}
                placeholder="Description"
                className="border p-2 rounded"
              />
              <select
                name="status"
                value={newCategory.status}
                onChange={handleSelectChange}
                className="border p-2 rounded"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end mt-6 gap-4">
              <button onClick={closeEditModal} className="bg-gray-600 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleSaveCategory} className="bg-green-600 text-white px-4 py-2 rounded">
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
              <button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleDeleteCategory} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Category;

import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;

const Stage = () => {
  const [stages, setStages] = useState<any[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newStage, setNewStage] = useState<any>({
    id: null,
    stage_icon: null,
    stage_name: "",
    description: "",
    status: "active",
  });

  const token = localStorage.getItem("token") || "";

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  // 🔹 Fetch stages
  const fetchStages = async () => {
    try {
      const res = await axios.get(`${API}/stages`, axiosConfig);
      setStages(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setError("Failed to load stages");
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  // 🔹 Auto clear messages
  useEffect(() => {
    if (message || error) {
      const t = setTimeout(() => {
        setMessage("");
        setError("");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [message, error]);

  // 🔹 Input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setNewStage({ ...newStage, [e.target.name]: e.target.value });
  };

  // 🔹 File change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setNewStage({ ...newStage, stage_icon: e.target.files[0] });
    }
  };
  const validateStage = () => {
    if (!newStage.stage_name.trim()) {
      setError("Stage Name is required");
      return false;
    }
    if (!newStage.description.trim()) {
      setError("Description is required");
      return false;
    }
    if (!newStage.stage_icon) {
      setError("Stage Icon is required");
      return false;
    }
    return true;
  };

  // -----------------------------
  // Save Stage
  // -----------------------------
  const handleSaveStage = async () => {
    try {
      if (!validateStage()) return;

      const formData = new FormData();
      formData.append("stage_name", newStage.stage_name);
      formData.append("description", newStage.description || "");
      formData.append("status", newStage.status);

      if (newStage.stage_icon instanceof File) {
        formData.append("stage_icon", newStage.stage_icon);
      }

      if (selectedIndex !== null) {
        await axios.put(`${API}/stages/${newStage.id}`, formData, axiosConfig);
        setMessage("Stage updated successfully");
      } else {
        await axios.post(`${API}/stages`, formData, axiosConfig);
        setMessage("Stage created successfully");
      }

      fetchStages();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError("Failed to save stage");
    }
  };

  // 🔹 Delete
  const handleDeleteStage = async () => {
    try {
      const stageId = stages[selectedIndex!]?.id;
      await axios.delete(`${API}/stages/${stageId}`, axiosConfig);
      setMessage("Stage deleted successfully");
      fetchStages();
      setIsDeleteModalOpen(false);
      setSelectedIndex(null);
    } catch {
      setError("Failed to delete stage");
    }
  };

  // 🔹 Edit
  const handleEditStage = (stage: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedIndex(index);
    setNewStage({
      id: stage.id,
      stage_icon: null, // IMPORTANT
      stage_name: stage.stage_name || "",
      description: stage.description || "",
      status: stage.status || "active",
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedIndex(null);
    setNewStage({
      id: null,
      stage_icon: null,
      stage_name: "",
      description: "",
      status: "active",
    });
  };

  const filteredStages = stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) =>
      JSON.stringify(stage).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {message && <div className="bg-green-100 text-green-700 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500">
          <Link to="/stages">/Stages</Link>
        </h1>
        {checkPermission("create_teststage") && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Add Stage
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto p-4">
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search stage..."
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Icon</th>
              <th className="p-3">Stage Name</th>
              <th className="p-3">Description</th>
              <th className="p-3">Status</th>
              {(checkPermission("update_teststage") || checkPermission("delete_teststage")) && (
                <th className="p-3">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredStages.map(({ stage, index }) => (
              <tr key={stage.id} className={`border-b ${index % 2 ? "bg-white" : "bg-yellow-50"}`}>
                <td className="p-3">
                  {stage.stage_icon ? (
                    <img
                      src={`${API}/${stage.stage_icon}`}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    "No Icon"
                  )}
                </td>
                <td className="p-3">{stage.stage_name}</td>
                <td className="p-3">{stage.description || "-"}</td>
                <td className="p-3">{stage.status}</td>
                <td className="p-3 flex gap-3">
                  {checkPermission("update_teststage") && (
                    <button onClick={() => handleEditStage(stage, index)}>
                      <EditIcon />
                    </button>
                  )}
                  {checkPermission("delete_teststage") && (
                    <button
                      onClick={() => {
                        setSelectedIndex(index);
                        setIsDeleteModalOpen(true);
                      }}
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

      {/* Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {selectedIndex !== null ? "Edit Stage" : "Add Stage"}
            </h2>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}

            <input
              type="text"
              name="stage_name"
              value={newStage.stage_name}
              onChange={handleInputChange}
              className="border p-2 rounded w-full mb-3"
              placeholder="Stage Name"
            />

            <textarea
              name="description"
              value={newStage.description}
              onChange={handleInputChange}
              className="border p-2 rounded w-full mb-3"
              placeholder="Description"
            />

            <select
              name="status"
              value={newStage.status}
              onChange={handleInputChange}
              className="border p-2 rounded w-full mb-3"
            >
              <option value="active">Active</option>
              <option value="inactive">Deactive</option>
            </select>

            <input type="file" onChange={handleFileChange} />

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={closeEditModal} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleSaveStage} className="bg-green-600 text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-96">
            <h2 className="text-lg font-bold mb-4">Confirm Delete</h2>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button onClick={handleDeleteStage} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stage;

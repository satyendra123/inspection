import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE;

const Unit = () => {
  const [units, setUnits] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newUnit, setNewUnit] = useState<any>({
    id: null,
    unit_name: "",
    status: "active",
  });

  const token = localStorage.getItem("token") || "";
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  // 🔹 Fetch Units
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
    fetchUnits();
  }, []);

  // 🔹 Auto clear alerts
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage("");
        setError("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // 🔹 Input handlers
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setNewUnit({ ...newUnit, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewUnit({ ...newUnit, [e.target.name]: e.target.value });
  };

  // 🔹 Add / Update Unit
  const handleSaveUnit = async () => {
    try {
      if (selectedUnitIndex !== null) {
        await axios.put(`${API}/units/${newUnit.id}`, newUnit, axiosConfig);
        setMessage("Unit updated successfully");
      } else {
        await axios.post(`${API}/units`, newUnit, axiosConfig);
        setMessage("Unit added successfully");
      }
      fetchUnits();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError("Failed to save unit");
    }
  };

  // 🔹 Delete Unit
  const handleDeleteUnit = async () => {
    try {
      const unitId = units[selectedUnitIndex!]?.id;
      await axios.delete(`${API}/units/${unitId}`, axiosConfig);
      setMessage("Unit deleted successfully");
      fetchUnits();
      setIsDeleteModalOpen(false);
      setSelectedUnitIndex(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete unit");
    }
  };

  // 🔹 Edit Unit
  const handleEditUnit = (unit: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedUnitIndex(index);
    setNewUnit({
      id: unit.id,
      unit_name: unit.unit_name || "",
      description: unit.description || "",
      status: unit.status || "active",
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedUnitIndex(null);
    setNewUnit({
      id: null,
      unit_name: "",
      description: "",
      status: "active",
    });
  };

  const filteredUnits = units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) =>
      JSON.stringify(unit).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {message && <div className="bg-green-100 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 p-3 rounded">{error}</div>}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500">
          <Link to="/units">
            <span className="hover:text-blue-800">Units</span>
          </Link>
        </h1>

        <button
          onClick={() => setIsEditModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Unit
        </button>
      </div>

      {/* Table */}
      <div className="mb-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search unit..."
          className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
        />
      </div>
      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-3">Unit Name</th>
            <th className="p-3">Status</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredUnits.map(({ unit: u, index }) => (
            <tr key={u.id} className="border-b">
              <td className="p-3 text-center">{u.unit_name}</td>
              <td className="p-3 text-center">{u.status}</td>
              <td className="p-3 flex justify-center items-center  gap-3">
                <button onClick={() => handleEditUnit(u, index)}>
                  <EditIcon />
                </button>
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(true);
                    setSelectedUnitIndex(index);
                  }}
                >
                  <DeleteIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {selectedUnitIndex !== null ? "Edit Unit" : "Add Unit"}
            </h2>

            <input
              name="unit_name"
              value={newUnit.unit_name}
              onChange={handleInputChange}
              placeholder="Unit Name"
              className="border p-2 w-full mb-3"
            />
            <select
              name="status"
              value={newUnit.status}
              onChange={handleSelectChange}
              className="border p-2 w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={closeEditModal}>Cancel</button>
              <button onClick={handleSaveUnit} className="bg-green-600 text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded">
            <h2 className="font-bold mb-4">Confirm Delete</h2>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button onClick={handleDeleteUnit} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Unit;

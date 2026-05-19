import { useEffect, useState } from "react";
import axios from "axios";
import { DeleteIcon, EditIcon } from "../hooks/Icons";
import { Link } from "react-router-dom";
import { checkPermission } from "../components/CheckPermission";

const API = import.meta.env.VITE_API_BASE;

const Test = () => {
  const [tests, setTests] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTestIndex, setSelectedTestIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newTest, setNewTest] = useState<any>({
    id: null,
    test_name: "",
    instrument: "",
    description: "",
    status: "active",
    test_icon: null,
    document: null,
  });

  const token = localStorage.getItem("token") || "";
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data", // for file uploads
    },
  };

  // Fetch tests
  const fetchTests = async () => {
    try {
      const res = await axios.get(`${API}/tests`, axiosConfig);
      setTests(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load tests");
    }
  };

  useEffect(() => {
    fetchTests();
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
    setNewTest({ ...newTest, [e.target.name]: e.target.value });
  };

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setNewTest({ ...newTest, [e.target.name]: e.target.files[0] });
    }
  };
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewTest({ ...newTest, [e.target.name]: e.target.value });
  };
  const validateTest = () => {
    if (!newTest.test_name.trim()) {
      setError("Test Name is required");
      return false;
    }
    // if (!newTest.instrument.trim()) {
    //   setError("Instrument is required");
    //   return false;
    // }
    if (!newTest.description.trim()) {
      setError("Description is required");
      return false;
    }
    // if (!newTest.test_icon) {
    //   setError("Test Icon is required");
    //   return false;
    // }
    // if (!newTest.document) {
    //   setError("Document is required");
    //   return false;
    // }
    return true;
  };

  // Save (Add/Update) test
  const handleSaveTest = async () => {
    try {
      if (!validateTest()) return; // run validation first

      const formData = new FormData();
      formData.append("test_name", newTest.test_name);
      formData.append("instrument", newTest.instrument);
      formData.append("description", newTest.description);
      formData.append("status", newTest.status);
      if (newTest.test_icon) formData.append("test_icon", newTest.test_icon);
      if (newTest.document) formData.append("document", newTest.document);

      if (selectedTestIndex !== null) {
        // Update
        await axios.put(`${API}/tests/${newTest.id}`, formData, axiosConfig);
        setMessage("Test updated successfully");
      } else {
        // Create
        await axios.post(`${API}/tests`, formData, axiosConfig);
        setMessage("Test added successfully");
      }
      fetchTests();
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError("Failed to save test");
    }
  };

  // Delete test
  const handleDeleteTest = async () => {
    try {
      const testId = tests[selectedTestIndex!]?.id;
      await axios.delete(`${API}/tests/${testId}`, axiosConfig);
      setMessage("Test deleted successfully");
      fetchTests();
      setIsDeleteModalOpen(false);
      setSelectedTestIndex(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete test");
    }
  };

  // Edit test
  const handleEditTest = (test: any, index: number) => {
    setIsEditModalOpen(true);
    setSelectedTestIndex(index);
    setNewTest({
      id: test.id,
      test_name: test.test_name || "",
      instrument: test.instrument || "",
      description: test.description || "",
      status: test.status || "active",
      test_icon: null,
      document: null,
    });
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedTestIndex(null);
    setNewTest({
      id: null,
      test_name: "",
      instrument: "",
      description: "",
      status: "active",
      test_icon: null,
      document: null,
    });
  };

  const filteredTests = tests
    .map((test, index) => ({ test, index }))
    .filter(({ test }) =>
      JSON.stringify(test).toLowerCase().includes(searchTerm.toLowerCase()),
    );

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Alerts */}
      {message && <div className="bg-green-100 border text-green-700 p-3 rounded">{message}</div>}
      {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-500 flex items-center gap-2">
          <Link to="/tests">
            <span className="hover:text-blue-800">/Tests</span>
          </Link>
        </h1>
        {checkPermission("create_teststep") && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            Add Test
          </button>
        )}
      </div>

      {/* Tests Table */}
      <div className="overflow-x-auto p-4">
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search test..."
            className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-3">Icon</th>
              <th className="p-3">Test Name</th>
              <th className="p-3">Instrument</th>
              <th className="p-3">Description</th>
              <th className="p-3">View Documents</th>
              <th className="p-3">Status</th>
              {(checkPermission("update_teststep") || checkPermission("delete_teststep")) && (
                <th className="p-3">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.isArray(filteredTests) &&
              filteredTests.map(({ test: t, index }) => (
                <tr key={t.id} className={`border-b ${index % 2 === 0 ? "bg-yellow-50" : "bg-white"} m-5 p-5`}>
                  <td className="p-3">
                    {t.test_icon ? (
                      <img
                        src={`${API}/${t.test_icon}`} // Adjust API URL if needed
                        alt={t.test_name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <span>No Icon</span>
                    )}
                  </td>

                  <td className="p-3">{t.test_name}</td>
                  <td className="p-3">{t.instrument}</td>
                  <td className="p-3">{t.description}</td>
                  <td className="p-3">
                    {t.document || (t.attachment && t.attachment.length > 0) ? (
                      <>
                        {t.document && (
                          <a
                            href={`${API}/${t.document}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-500 hover:underline"
                          >
                            Document
                          </a>
                        )}
                        {t.attachment?.map((file: string, idx: number) => (
                          <a
                            key={idx}
                            href={`${API}/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-500 hover:underline"
                          >
                            Attachment {idx + 1}
                          </a>
                        ))}
                      </>
                    ) : (
                      <span>No Attachments</span>
                    )}
                  </td>
                   <td className="p-3">{t.status}</td>
                  <td className="p-3 flex gap-3">
                    {checkPermission("update_teststep") && (
                      <button onClick={() => handleEditTest(t, index)} className="text-blue-500 hover:text-blue-700">
                        <EditIcon />
                      </button>
                    )}
                    {checkPermission("delete_teststep") && (
                      <button
                        onClick={() => {
                          setIsDeleteModalOpen(true);
                          setSelectedTestIndex(index);
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
              {selectedTestIndex !== null ? "Edit Test" : "Add New Test"}
            </h2>
            {error && <div className="bg-red-100 border text-red-700 p-3 rounded">{error}</div>}

            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                name="test_name"
                value={newTest.test_name}
                onChange={handleInputChange}
                placeholder="Test Name"
                className="border p-2 rounded"
              />
              <input
                type="text"
                name="instrument"
                value={newTest.instrument}
                onChange={handleInputChange}
                placeholder="Instrument"
                className="border p-2 rounded"
              />
              <textarea
                name="description"
                value={newTest.description}
                onChange={handleInputChange}
                placeholder="Description"
                className="border p-2 rounded"
              />
              <select
                name="status"
                value={newTest.status}
                onChange={handleSelectChange}
                className="border p-2 rounded"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <label className="block mb-1 font-medium">Test Icon</label>

              <input type="file" name="test_icon" onChange={handleFileChange} />
             <label className="block mb-1 font-medium">Document</label>

              <input type="file" name="document" onChange={handleFileChange} />
            </div>

            <div className="flex justify-end mt-6 gap-4">
              <button onClick={closeEditModal} className="bg-gray-600 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={handleSaveTest} className="bg-green-600 text-white px-4 py-2 rounded">
                {selectedTestIndex !== null ? "Update" : "Save"}
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
              <button onClick={handleDeleteTest} className="bg-red-600 text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Test;

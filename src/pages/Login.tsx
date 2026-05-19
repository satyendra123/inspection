import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import logo from "../icons/iqiss.jpeg";

const API = import.meta.env.VITE_API_BASE;

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    username: "",
    password: "",
    remember: false,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${API}/admin/login`, {
        username: form.username,
        password: form.password,
      });

      /**
       * Expected response:
       * {
       *   token: "...",
       *   expiresIn: "24h"
       * }
       */
      if (res.data?.token) {
        // save token via AuthContext
        login(res.data.token);

        // remember flag
        if (form.remember) {
          localStorage.setItem("remember", "1");
        } else {
          localStorage.removeItem("remember");
        }

        // redirect to dashboard
        navigate("/", { replace: true });
      } else {
        alert("Invalid login response");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.msg || "Login failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50">
      <div className="min-h-screen flex flex-col items-center justify-center py-6 px-4">
        <div className="max-w-[480px] w-full">
          <a href="javascript:void(0)">
            <img
              src={logo}
              alt="logo"
              className="w-40 mb-8 mx-auto block"
            />
          </a>

          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <h1 className="text-slate-900 text-center text-3xl font-semibold">
              Sign in
            </h1>

            <form className="mt-12 space-y-6" onSubmit={handleSubmit}>
              {/* Username */}
              <div>
                <label className="text-slate-900 text-sm font-medium mb-2 block">
                  User name
                </label>
                <div className="relative flex items-center">
                  <input
                    name="username"
                    type="text"
                    required
                    value={form.username}
                    onChange={handleChange}
                    className="w-full text-slate-900 text-sm border border-slate-300 px-4 py-3 pr-8 rounded-md outline-blue-600"
                    placeholder="Enter user name"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-slate-900 text-sm font-medium mb-2 block">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    name="password"
                    type="password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    className="w-full text-slate-900 text-sm border border-slate-300 px-4 py-3 pr-8 rounded-md outline-blue-600"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember"
                    type="checkbox"
                    checked={form.remember}
                    onChange={handleChange}
                    className="h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-3 block text-sm text-slate-900"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              {/* Submit */}
              <div className="!mt-12">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 text-[15px] font-medium tracking-wide rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none cursor-pointer"
                >
                  {loading ? "Please wait..." : "Sign in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8060/api";

export const api = axios.create({
  baseURL: API,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
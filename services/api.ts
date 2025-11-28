// src/services/api.ts
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    school_id: number | null;
  };
}

export const login = async (
  email: string,
  password: string,
  role: string
): Promise<LoginResponse> => {
  const res = await api.post("/auth/login", { email, password, role });
  return res.data;
};

export default api;

import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { auth } from "./firebase";

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach the Firebase ID token to every request automatically
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise error responses
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail;
    let message: string;
    if (Array.isArray(detail)) {
      // FastAPI 422 validation errors: [{loc, msg, type}, ...]
      message = detail.map((e: { msg?: string; loc?: string[] }) => {
        const field = e.loc ? e.loc[e.loc.length - 1] : "";
        return field ? `${field}: ${e.msg}` : (e.msg ?? "Validation error");
      }).join(", ");
    } else {
      message = detail ?? err.message ?? "Unknown error";
    }
    return Promise.reject(new Error(message));
  }
);

export default api;

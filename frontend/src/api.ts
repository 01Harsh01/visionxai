import axios from "axios";

export const getToken = () => {
  const t = localStorage.getItem("vx_token");
  if (!t || t === "undefined" || t === "null" || t === "[object Object]") return null;
  return t;
};

export const setToken = (t: string | null) => {
  if (t && t !== "undefined" && t !== "null") {
    localStorage.setItem("vx_token", t);
  } else {
    localStorage.removeItem("vx_token");
  }
};

const defaultBackendUrl = "https://visionxai-1.onrender.com";

const rawEnv = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_SERVER_URL ||
  import.meta.env.VITE_RENDER_URL ||
  import.meta.env.VITE_PUBLIC_API_URL ||
  defaultBackendUrl
)
  .toString()
  .replace(/^["']|["']$/g, "")
  .trim()
  .replace(/\/$/, "");

export const API_BASE = rawEnv ? (rawEnv.endsWith("/api") ? rawEnv : `${rawEnv}/api`) : "/api";

export const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

api.interceptors.request.use((c) => {
  const t = getToken();
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      setToken(null);
    }
    return Promise.reject(e);
  }
);

export const imgUrl = (id: number) => `${API_BASE}/images/${id}/file?token=${getToken() || ""}`;

export const errMsg = (e: any) => {
  if (e?.code === "ECONNABORTED" || e?.message?.includes("timeout")) {
    return "Request timed out while waiting for model inference. Please try again.";
  }
  if (e?.message === "Network Error") {
    return "Network error: The Render backend is currently starting or waking up. Please try again in a few seconds.";
  }
  return e?.response?.data?.detail?.toString?.() ?? e?.message ?? "Something went wrong";
};

export type Img = { id: number; name: string; w: number; h: number; score?: number };

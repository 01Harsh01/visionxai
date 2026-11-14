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

const rawEnv = (import.meta.env.VITE_API_URL || "").toString().replace(/^["']|["']$/g, "").trim().replace(/\/$/, "");
export const API_BASE = rawEnv ? (rawEnv.endsWith("/api") ? rawEnv : `${rawEnv}/api`) : "/api";

export const api = axios.create({ baseURL: API_BASE });

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
  if (e?.response?.status === 405) {
    return "Request failed (405): Backend API URL not reachable. Ensure VITE_API_URL is set in Vercel and the deployment is rebuilt.";
  }
  return e?.response?.data?.detail?.toString?.() ?? e?.message ?? "Something went wrong";
};

export type Img = { id: number; name: string; w: number; h: number; score?: number };

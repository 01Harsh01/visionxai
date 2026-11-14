import axios from "axios";

export const getToken = () => localStorage.getItem("vx_token");
export const setToken = (t: string | null) =>
  t ? localStorage.setItem("vx_token", t) : localStorage.removeItem("vx_token");

const rawBase = (((import.meta as any).env?.VITE_API_URL as string) || "").trim().replace(/\/$/, "");
export const API_BASE = rawBase ? (rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`) : "/api";

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
      location.reload();
    }
    return Promise.reject(e);
  }
);

export const imgUrl = (id: number) => `${API_BASE}/images/${id}/file?token=${getToken()}`;

export const errMsg = (e: any) =>
  e?.response?.data?.detail?.toString?.() ?? e?.message ?? "Something went wrong";

export type Img = { id: number; name: string; w: number; h: number; score?: number };

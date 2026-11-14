import axios from "axios";

export const getToken = () => localStorage.getItem("vx_token");
export const setToken = (t: string | null) =>
  t ? localStorage.setItem("vx_token", t) : localStorage.removeItem("vx_token");

export const getCustomApiUrl = () => localStorage.getItem("vx_api_url") || "";
export const setCustomApiUrl = (url: string) => {
  const cleaned = (url || "").trim().replace(/\/$/, "");
  if (cleaned) {
    localStorage.setItem("vx_api_url", cleaned);
  } else {
    localStorage.removeItem("vx_api_url");
  }
};

export const getApiBase = () => {
  const custom = getCustomApiUrl();
  const envUrl = (((import.meta as any).env?.VITE_API_URL as string) || "").trim().replace(/\/$/, "");
  const rawBase = custom || envUrl;
  return rawBase ? (rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`) : "/api";
};

export const api = axios.create();

api.interceptors.request.use((c) => {
  c.baseURL = getApiBase();
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

export const imgUrl = (id: number) => `${getApiBase()}/images/${id}/file?token=${getToken()}`;

export const errMsg = (e: any) => {
  if (e?.response?.status === 405) {
    return "Error 405: Backend API URL not connected. Please enter your Render backend URL below.";
  }
  return e?.response?.data?.detail?.toString?.() ?? e?.message ?? "Something went wrong";
};

export type Img = { id: number; name: string; w: number; h: number; score?: number };

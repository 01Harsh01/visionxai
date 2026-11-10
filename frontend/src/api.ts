import axios from "axios";
export const getToken = () => localStorage.getItem("vx_token");
export const setToken = (t: string | null) => (t ? localStorage.setItem("vx_token", t) : localStorage.removeItem("vx_token"));
export const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => { const t = getToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => { if (e.response?.status === 401) { setToken(null); location.reload(); } return Promise.reject(e); });
export const imgUrl = (id: number) => `/api/images/${id}/file?token=${getToken()}`;
export const errMsg = (e: any) => e?.response?.data?.detail?.toString?.() ?? e?.message ?? "Something went wrong";
export type Img = { id: number; name: string; w: number; h: number; score?: number };

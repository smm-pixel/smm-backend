import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;
const normalizedBackendUrl = BACKEND_URL.replace(/\/+$/, "").replace(/\/api$/i, "");
export const API = `${normalizedBackendUrl}/api`;

// withCredentials sends & receives the HttpOnly auth cookie automatically.
const api = axios.create({ baseURL: API, withCredentials: true });

const PUBLIC_PATHS = ["/", "/login"];

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      try { localStorage.removeItem("bumdes_user"); } catch {}
      // Only redirect to /login when user is on a protected route.
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export const getApiError = (error, fallback = "Terjadi kesalahan. Silakan coba lagi.") => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  return detail || error?.message || fallback;
};

export const request = async (promise, options = {}) => {
  const { onError } = options;
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    onError?.(getApiError(error));
    throw error;
  }
};

export const fmtRp = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "Rp 0";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
};

export const fmtDate = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
};

export const ROLE_LABELS = {
  admin: "Admin Utama",
  direktur: "Direktur",
  bendahara: "Bendahara",
  pengelola: "Pengelola Unit",
  pengawas: "Pengawas",
  penasihat: "Penasihat",
};

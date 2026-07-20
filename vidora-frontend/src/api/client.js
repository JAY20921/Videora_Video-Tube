// src/api/client.js
import axios from "axios";

const rawBase = import.meta.env.VITE_API_BASE;
const baseURL = rawBase
  ? `${rawBase.replace(/\/+$/, "")}/api/v1`
  : "http://localhost:8000/api/v1";
  
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// ─── Global toast callback ────────────────────────────────────────────────────
// This is set by the ToastProvider at mount time so the API layer can push
// user-visible error toasts without coupling to React.
let _toastFn = null;
export const setGlobalToast = (fn) => { _toastFn = fn; };

function showToast(message, opts) {
  if (_toastFn) _toastFn(message, opts);
}

/**
 * Extract a user-friendly error message from an Axios error.
 */
function getErrorMessage(error) {
  // Network error — server is unreachable
  if (!error.response) {
    if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
      return "Server is unreachable. Please check your internet connection or try again later.";
    }
    if (error.code === "ECONNABORTED") {
      return "Request timed out. The server took too long to respond.";
    }
    return error.message || "An unexpected network error occurred.";
  }

  const { status, data } = error.response;

  // Validation errors (Zod) — return the array of field messages
  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map(e => e.message || e.field).join(". ");
  }

  // Server-provided message
  if (data?.message) return data.message;

  // Fallback by status code
  switch (status) {
    case 400: return "Invalid request. Please check your input.";
    case 401: return "Session expired. Please log in again.";
    case 403: return "You don't have permission to do that.";
    case 404: return "The requested resource was not found.";
    case 409: return "This action conflicts with the current state.";
    case 413: return "File is too large. Maximum size is 100MB.";
    case 415: return "Unsupported file type.";
    case 429: return data?.message || "Too many requests. Please slow down.";
    case 500: return "Server error. Our team has been notified.";
    case 502: return "Server is temporarily unavailable. Please try again.";
    case 503: return "Service is under maintenance. Please try again later.";
    default:  return `Something went wrong (Error ${status}).`;
  }
}

// ─── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor: auto-refresh + global error toasts ─────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue = [];
};

// URLs that should NOT show global error toasts (they handle errors locally)
const SILENT_URLS = [
  "/users/login",
  "/users/register",
  "/users/refresh-token",
  "/users/current-user",
  "/videos/view/",
  "/watch-progress",
];

function shouldSilence(url) {
  return SILENT_URLS.some(s => url?.includes(s));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if this IS the refresh or login request
      if (
        originalRequest.url?.includes("/users/refresh-token") ||
        originalRequest.url?.includes("/users/login")
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while another refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post("/users/refresh-token");
        const newToken = res.data?.data?.accessToken;
        if (newToken) {
          localStorage.setItem("accessToken", newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed — token is truly expired, user needs to login again
        localStorage.removeItem("accessToken");
        showToast("Session expired. Please log in again.", { type: "error", duration: 5000 });
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Global error toast for non-silent requests ──────────────────────────
    if (!shouldSilence(originalRequest?.url)) {
      const status = error.response?.status;
      // Don't toast for 401 (handled above) or cancellation
      if (status !== 401 && error.name !== "CanceledError" && error.name !== "AbortError") {
        const msg = getErrorMessage(error);
        const type = status >= 500 || !error.response ? "error" : "error";
        showToast(msg, { type, duration: status >= 500 ? 6000 : 4000 });
      }
    }

    return Promise.reject(error);
  }
);

export default api;

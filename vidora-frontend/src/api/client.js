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

// ─── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor: auto-refresh expired access tokens ─────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue = [];
};

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
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

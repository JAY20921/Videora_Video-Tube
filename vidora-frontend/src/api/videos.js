// src/api/videos.js
import api from "./client";

// Get all videos
export const getAllVideos = async () => {
  const res = await api.get("/videos");
  return res.data;
};

export const searchVideos = async (query) => {
  const res = await api.get(`/videos?query=${encodeURIComponent(query)}`);
  const body = res.data;
  if (Array.isArray(body)) return body;
  if (body?.data?.videos) return body.data.videos;
  if (body?.videos) return body.videos;
  if (Array.isArray(body?.data)) return body.data;
  return [];
};

export const fetchVideos = async ({ limit = 24, userId } = {}) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (userId) params.set("userId", String(userId));
  const res = await api.get(`/videos?${params.toString()}`);
  const body = res.data;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data?.videos)) return body.data.videos;
  if (Array.isArray(body?.videos)) return body.videos;
  if (Array.isArray(body?.data)) return body.data;
  return [];
};

export const getVideoById = async (id) => {
  const res = await api.get(`/videos/${id}`);
  return res.data;
};

export const incrementView = async (id) => {
  if (!id) return null;
  try {
    const res = await api.post(`/videos/${id}/view`);
    return res.data;
  } catch {
    return null;
  }
};

export const uploadVideo = async (formData, onUploadProgress, { signal } = {}) => {
  const res = await api.post("/videos", formData, {
    onUploadProgress: (evt) => {
      if (!onUploadProgress || !evt.total) return;
      onUploadProgress(Math.round((evt.loaded * 100) / evt.total));
    },
    signal,
  });
  return res.data;
};

export const likeVideo = async (id) => {
  const res = await api.post(`/videos/${id}/like`);
  return res.data;
};

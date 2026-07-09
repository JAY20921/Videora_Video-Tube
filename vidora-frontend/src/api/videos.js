// src/api/videos.js
import axios from "./client";

// ✅ Get ALL videos
export const getAllVideos = async () => {
  const res = await axios.get("/videos");
  return res.data;
};

// ✅ Search videos
export const searchVideos = async (query) => {
  // backend implements search via the main videos route `GET /videos?query=...`
  const res = await axios.get(`/videos?query=${encodeURIComponent(query)}`);
  const body = res.data;

  // Normalize the response to return an array of videos
  if (Array.isArray(body)) return body;
  // ApiResponse shape: { statusCode, data: { videos, meta }, message, success }
  if (body?.data?.videos) return body.data.videos;
  if (body?.videos) return body.videos;
  // fallback: maybe data is already an array
  if (Array.isArray(body?.data)) return body.data;

  return [];
};

// ❌ Your frontend wrongly calls fetchVideos()
// 👉 So we create fetchVideos to avoid breaking other components
export const fetchVideos = async ({ limit = 24, userId } = {}) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (userId) params.set("userId", String(userId));
  const res = await axios.get(`/videos?${params.toString()}`);
  const body = res.data;

  // Normalize to ALWAYS return an array
  if (Array.isArray(body)) return body;

  // ApiResponse shape
  if (Array.isArray(body?.data?.videos)) return body.data.videos;
  if (Array.isArray(body?.videos)) return body.videos;

  // fallback
  if (Array.isArray(body?.data)) return body.data;

  return [];
};


// ✅ Get single video
export const getVideoById = async (id) => {
  const res = await axios.get(`/videos/${id}`);
  return res.data;
};

// increment view count for a video (called when playback starts)
export const incrementView = async (id) => {
  if (!id) return null;
  try {
    const res = await axios.post(`/videos/view/${id}`);
    return res.data;
  } catch (e) {
    // ignore errors - view counting is best-effort
    return null;
  }
};

export const uploadVideo = async (formData, onUploadProgress, { signal } = {}) => {
  const res = await axios.post("/videos", formData, {
    onUploadProgress: (evt) => {
      if (onUploadProgress) {
        let percent = 0;

        if (evt.total && evt.total > 0) {
          percent = Math.round((evt.loaded * 100) / evt.total);
        } else if (evt.loaded) {
          // fallback: assume 100% at the end
          percent = 100;
        }

        onUploadProgress(percent);
      }
    },
    signal,
  });
  return res.data;
};

// Like video
export const likeVideo = async (id) => {
  const res = await axios.post(`/likes/toggle/v/${id}`);
  return res.data;
};

// Phase 3: Poll video processing status
export const getVideoStatus = async (id) => {
  const res = await axios.get(`/videos/status/${id}`);
  return res.data?.data ?? { status: "ready" };
};

// Retranscode video
export const retranscodeVideo = async (id) => {
  const res = await axios.post(`/videos/retranscode/${id}`);
  return res.data;
};

// Phase 7: Fetch recommendations for a video
export const fetchRecommendations = async (id, limit = 6) => {
  const res = await axios.get(`/videos/${id}/recommendations?limit=${limit}`);
  const body = res.data;
  
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  
  return [];
};

export const deleteVideo = async (id) => {
  const res = await axios.delete(`/videos/${id}`);
  return res.data;
};

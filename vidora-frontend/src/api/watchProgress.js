// src/api/watchProgress.js
import api from "./client";

/**
 * Save progress via authenticated axios POST.
 * Used for regular heartbeats (every 10s) where the page is still alive.
 */
export const saveProgress = async ({ videoId, progressSeconds }) => {
  await api.post("/watch-progress", { videoId, progressSeconds });
};

/**
 * Fire-and-forget save via navigator.sendBeacon.
 * ONLY used on beforeunload — sendBeacon doesn't support custom headers,
 * so this relies on cookies for auth. For cross-origin setups where cookies
 * aren't sent, this is best-effort (the last heartbeat already saved the position).
 */
export const saveProgressBeacon = ({ videoId, progressSeconds }) => {
  const token = localStorage.getItem("accessToken");
  if (!token) return; // Don't attempt to save if not logged in

  const url = `${api.defaults.baseURL}/watch-progress`;
  const body = JSON.stringify({ videoId, progressSeconds });

  // Use fetch with keepalive instead of sendBeacon so we can attach custom Auth headers
  try {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (error) {
    // Ignore fetch errors during unmount
  }
};

/**
 * Fetch the user's saved progress for a specific video.
 * Returns { progressSeconds: number }
 */
export const getProgress = async (videoId) => {
  const res = await api.get(`/watch-progress/${videoId}`);
  return res.data?.data ?? { progressSeconds: 0 };
};

/**
 * Fetch paginated in-progress watch history.
 * Returns the "Continue Watching" list.
 */
export const getWatchHistory = async ({ page = 1, limit = 12 } = {}) => {
  const res = await api.get(`/watch-progress/history?page=${page}&limit=${limit}`);
  return res.data?.data ?? { history: [], page, limit };
};

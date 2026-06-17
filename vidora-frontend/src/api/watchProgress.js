// src/api/watchProgress.js
import api from "./client";

/**
 * Upsert the current user's watch progress for a video.
 * Called on heartbeat (every 10s) and on pause/beforeunload.
 * Uses navigator.sendBeacon for reliability on tab close.
 */
export const saveProgress = async ({ videoId, progressSeconds }) => {
  // sendBeacon fires even when the page is being unloaded
  if (typeof navigator?.sendBeacon === "function") {
    const blob = new Blob(
      [JSON.stringify({ videoId, progressSeconds })],
      { type: "application/json" }
    );
    navigator.sendBeacon(
      `${api.defaults.baseURL}/watch-progress`,
      blob
    );
    return;
  }
  // Fallback for environments without sendBeacon (e.g. tests)
  await api.post("/watch-progress", { videoId, progressSeconds });
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

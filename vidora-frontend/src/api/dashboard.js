// src/api/dashboard.js
import api from "./client";

const unwrap = (res) => res?.data?.data ?? res?.data ?? res;

/** Get channel stats — total videos, views, subscribers, likes */
export const getChannelStats = async () => {
  const res = await api.get("/dashboard/stats");
  return unwrap(res);
};

/** Get all videos uploaded by the current user */
export const getChannelVideos = async () => {
  const res = await api.get("/dashboard/videos");
  return unwrap(res);
};

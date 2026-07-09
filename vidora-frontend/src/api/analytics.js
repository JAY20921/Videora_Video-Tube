import axios from "./client";

export const emitTelemetry = async (videoId, eventType, timestamp) => {
  try {
    // Fire and forget
    axios.post(
      `/analytics/event`,
      { videoId, eventType, timestamp }
    );
  } catch (error) {
    // Silent fail for telemetry
  }
};

export const getVideoAnalytics = async (videoId) => {
  try {
    const res = await axios.get(`/analytics/video/${videoId}`);
    return res.data.data;
  } catch (error) {
    console.error("Failed to fetch analytics", error);
    return null;
  }
};

// src/api/ai.js
import api from "./client";

/**
 * POST /ai/ask — RAG Tutor
 * Ask a question about a specific video's content.
 * Returns AI answer with timestamp citations.
 */
export const askQuestion = async (videoId, question) => {
  const res = await api.post("/ai/ask", { videoId, question });
  return res.data?.data ?? res.data;
};

/**
 * GET /ai/transcript/:videoId
 * Get the full transcript with segments, chapters, and knowledge graph.
 */
export const getTranscript = async (videoId) => {
  const res = await api.get(`/ai/transcript/${videoId}`);
  return res.data?.data ?? res.data;
};

/**
 * GET /ai/status/:videoId
 * Poll AI processing status.
 */
export const getAiStatus = async (videoId) => {
  const res = await api.get(`/ai/status/${videoId}`);
  return res.data?.data ?? { aiStatus: "pending" };
};

/**
 * POST /ai/skill-tree
 * Generate a dynamic learning path based on a topic.
 */
export const generateSkillTree = async (topic) => {
  const res = await api.post("/ai/skill-tree", { topic });
  return res.data?.data ?? res.data;
};

/**
 * Phase 5: AI controller.
 *
 * Provides endpoints for the AI Tutor (RAG), transcript retrieval,
 * and AI processing status polling.
 */
import { Video } from "../models/video.model.js";
import { Transcript } from "../models/transcript.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { embedQuery } from "../services/embedding.service.js";
import { searchSimilar } from "../services/vectorStore.service.js";
import { getGroqClient } from "../config/groq.js";
import { config } from "../config/index.js";
import { isValidObjectId } from "mongoose";
import { logger } from "../utils/logger.js";

/**
 * POST /api/v1/ai/ask
 * Body: { videoId, question }
 *
 * RAG Tutor: Embeds the user's question, performs vector search
 * scoped to the video, retrieves top chunks, and generates an
 * AI answer with timestamp citations.
 */
const askQuestion = asyncHandler(async (req, res) => {
  const { videoId, question } = req.body;

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Valid videoId is required");
  }
  if (!question || question.trim().length < 3) {
    throw new ApiError(400, "Question must be at least 3 characters");
  }

  // Check video exists and has AI ready
  const video = await Video.findById(videoId).select("title aiStatus").lean();
  if (!video) throw new ApiError(404, "Video not found");

  if (video.aiStatus !== "ready") {
    throw new ApiError(422, `AI features not ready for this video (status: ${video.aiStatus})`);
  }

  const groq = getGroqClient();
  if (!groq) throw new ApiError(503, "AI service unavailable — GROQ_API_KEY not configured");

  // 1. Embed the question
  const queryVector = await embedQuery(question.trim());

  // 2. Search Qdrant for relevant chunks (scoped to this video)
  const chunks = await searchSimilar(queryVector, videoId, 5);

  if (chunks.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, {
        answer: "I couldn't find relevant content in this video's transcript to answer your question. Try asking about a specific topic discussed in the video.",
        citations: [],
        videoId,
      }, "No relevant context found")
    );
  }

  // 3. Build RAG context
  const context = chunks
    .map((c, i) => `[Chunk ${i + 1} — ${formatTime(c.startTime)}–${formatTime(c.endTime)}]\n${c.text}`)
    .join("\n\n");

  // 4. Generate answer with Groq LLM
  const response = await groq.chat.completions.create({
    model: config.groq.chatModel,
    messages: [
      {
        role: "system",
        content: `You are an AI Tutor for the video "${video.title}". Answer the user's question using ONLY the provided transcript chunks. Follow these rules:

1. Ground your answer strictly in the transcript content
2. Cite timestamps using [MM:SS] format when referencing specific content
3. If the transcript doesn't contain enough information to fully answer, say so honestly
4. Keep your answer concise but informative (2-4 paragraphs max)
5. Use markdown formatting for clarity (bold key terms, use bullet points when listing)

Transcript context:
${context}`,
      },
      {
        role: "user",
        content: question.trim(),
      },
    ],
    temperature: 0.4,
    max_tokens: 1500,
  });

  const answer = response.choices[0]?.message?.content || "Unable to generate an answer.";

  // 5. Build citations from the chunks used
  const citations = chunks.map((c) => ({
    text: c.text.slice(0, 120) + (c.text.length > 120 ? "…" : ""),
    startTime: c.startTime,
    endTime: c.endTime,
    score: Math.round(c.score * 100) / 100,
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      answer,
      citations,
      videoId,
      model: config.groq.chatModel,
    }, "AI Tutor response")
  );
});

/**
 * GET /api/v1/ai/transcript/:videoId
 * Returns the full transcript with segments, chapters, and concepts.
 */
const getTranscript = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const transcript = await Transcript.findOne({ video: videoId })
    .select("-chunks.qdrantPointId") // Don't expose internal IDs
    .lean();

  if (!transcript) {
    throw new ApiError(404, "Transcript not found — AI processing may not have completed yet");
  }

  return res.status(200).json(
    new ApiResponse(200, transcript, "Transcript fetched")
  );
});

/**
 * GET /api/v1/ai/status/:videoId
 * Returns the current AI processing status.
 * Used by the frontend to poll until AI features are available.
 */
const getAiStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId).select("aiStatus transcript").lean();
  if (!video) throw new ApiError(404, "Video not found");

  let transcriptStatus = null;
  if (video.transcript) {
    const t = await Transcript.findById(video.transcript).select("status").lean();
    transcriptStatus = t?.status || null;
  }

  return res.status(200).json(
    new ApiResponse(200, {
      aiStatus: video.aiStatus,
      transcriptId: video.transcript ? String(video.transcript) : null,
      transcriptStatus,
    }, "AI status fetched")
  );
});

/**
 * Format seconds to MM:SS or HH:MM:SS string.
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export { askQuestion, getTranscript, getAiStatus };

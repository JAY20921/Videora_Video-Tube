/**
 * Phase 5: AI controller.
 *
 * Provides endpoints for the AI Tutor (RAG), transcript retrieval,
 * and AI processing status polling.
 */
import { Video } from "../models/video.model.js";
import { Transcript } from "../models/transcript.model.js";
import { Playlist } from "../models/playlist.model.js";
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
  const video = await Video.findById(videoId).select("title description aiStatus").lean();
  if (!video) throw new ApiError(404, "Video not found");

  if (video.aiStatus !== "ready") {
    throw new ApiError(422, `AI features not ready for this video (status: ${video.aiStatus})`);
  }

  const groq = getGroqClient();
  if (!groq) throw new ApiError(503, "AI service unavailable — GROQ_API_KEY not configured");

  // 1. Try vector search first (works when OPENAI_API_KEY is set)
  let chunks = [];
  try {
    const queryVector = await embedQuery(question.trim());
    chunks = await searchSimilar(queryVector, videoId, 5);
  } catch (err) {
    logger.warn({ err: err.message, videoId }, "Vector search failed — falling back to text search");
  }

  // 2. Fallback: keyword search on transcript segments in MongoDB
  if (chunks.length === 0) {
    logger.info({ videoId }, "Vector search returned 0 results — using transcript text search fallback");
    const transcript = await Transcript.findOne({ video: videoId }).lean();
    
    if (transcript?.segments?.length) {
      // Extract meaningful keywords from the question (remove stop words)
      const stopWords = new Set([
        "what", "is", "the", "a", "an", "in", "on", "at", "to", "for", "of",
        "and", "or", "but", "with", "this", "that", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "can", "about", "how",
        "why", "when", "where", "who", "which", "there", "here", "it", "its",
        "they", "them", "their", "my", "your", "our", "me", "he", "she", "we",
        "you", "i", "not", "no", "so", "if", "from", "by", "as", "up", "out",
        "all", "just", "also", "than", "then", "very", "too", "any", "each",
        "tell", "explain", "describe", "discuss", "talked", "talk", "video",
      ]);
      const keywords = question.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

      if (keywords.length > 0) {
        // Score each segment by keyword overlap
        const scored = transcript.segments.map((seg) => {
          const segLower = seg.text.toLowerCase();
          let score = 0;
          for (const kw of keywords) {
            if (segLower.includes(kw)) score++;
          }
          return { ...seg, score };
        });

        // Get top segments that have at least 1 keyword match
        const topSegs = scored
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);

        if (topSegs.length > 0) {
          chunks = topSegs.map(s => ({
            text: s.text,
            startTime: s.start,
            endTime: s.end,
            score: s.score / keywords.length,
          }));
        }
      }

      // If keyword search also found nothing, use a representative sample of the transcript
      if (chunks.length === 0) {
        const totalSegs = transcript.segments.length;
        const sampleIndices = [
          0,
          Math.floor(totalSegs * 0.25),
          Math.floor(totalSegs * 0.5),
          Math.floor(totalSegs * 0.75),
          totalSegs - 1,
        ].filter((v, i, a) => a.indexOf(v) === i && v < totalSegs);

        chunks = sampleIndices.map(idx => ({
          text: transcript.segments[idx].text,
          startTime: transcript.segments[idx].start,
          endTime: transcript.segments[idx].end,
          score: 0.1,
        }));
      }
    }
  }

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
        content: `You are an AI Tutor for the video "${video.title}". ${video.description ? `Video description: ${video.description}` : ""}

Answer the user's question using ONLY the provided transcript chunks. Follow these rules:

1. Ground your answer strictly in the transcript content provided below
2. Cite timestamps using [MM:SS] format when referencing specific content
3. If the transcript doesn't contain enough information to fully answer, say so honestly
4. Keep your answer concise but informative (2-4 paragraphs max)
5. Use markdown formatting for clarity (**bold** key terms, use bullet points when listing)
6. Always try to reference at least one timestamp so the user can jump to the relevant part

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

/**
 * POST /api/v1/ai/skill-tree
 * Body: { topic }
 * Generates a dynamic learning path based on semantic search and Groq LLM.
 */
const generateSkillTree = asyncHandler(async (req, res) => {
  const { topic } = req.body;
  if (!topic || topic.trim().length < 2) {
    throw new ApiError(400, "Valid topic is required");
  }

  const groq = getGroqClient();
  if (!groq) throw new ApiError(503, "AI service unavailable");

  // 1. Try vector search (works when OPENAI_API_KEY is set)
  let uniqueVideoIds = [];
  try {
    const queryVector = await embedQuery(topic.trim());
    const chunks = await searchSimilar(queryVector, null, 40);
    if (chunks.length > 0) {
      uniqueVideoIds = [...new Set(chunks.map(c => c.videoId))];
    }
  } catch (err) {
    logger.warn({ err: err.message, topic }, "Vector search failed for Skill Tree — falling back to text search");
  }

  let videos = [];

  // 2. Fetch metadata for vector search results
  if (uniqueVideoIds.length > 0) {
    videos = await Video.find({ _id: { $in: uniqueVideoIds } })
      .select("_id title description")
      .lean();
  }

  // 3. Fallback: Full-text search on Video collection
  if (videos.length === 0) {
    logger.info({ topic }, "No vector search results — using MongoDB $text search for Skill Tree");
    
    // Use the existing text index on title and description
    videos = await Video.find(
      { $text: { $search: topic }, isPublished: true },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(10)
    .select("_id title description")
    .lean();

    // If still no results, fallback to a basic regex search on title
    if (videos.length === 0) {
      const keywords = topic.trim().split(/\s+/).filter(w => w.length > 2);
      if (keywords.length > 0) {
        const regexStr = keywords.map(k => `(?=.*${k})`).join('');
        videos = await Video.find({ 
          title: { $regex: regexStr, $options: 'i' },
          isPublished: true 
        })
        .limit(10)
        .select("_id title description")
        .lean();
      }
    }
  }

  if (videos.length === 0) {
    throw new ApiError(404, "No relevant videos found for this topic to build a skill tree");
  }

  // 5. Build prompt
  const videoContext = videos.map(v => `ID: ${v._id}\nTitle: ${v.title}\nDescription: ${v.description || "N/A"}`).join("\n\n");

  const prompt = `You are an expert AI curriculum designer. Build a logical learning path (Skill Tree) for the topic "${topic}" using the following candidate videos. Order them from beginner to advanced. You MUST select at least 1 video, picking the most relevant ones available even if they are only tangentially related.

Candidate Videos:
${videoContext}

Return ONLY a valid JSON object with this exact structure (no markdown, no backticks, just raw JSON):
{
  "title": "A catchy title for the playlist",
  "description": "A short summary of what the user will learn",
  "videoIds": ["id1", "id2", "id3"]
}`;

  // 6. Generate with Groq
  const response = await groq.chat.completions.create({
    model: config.groq.chatModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  let content = response.choices[0]?.message?.content || "";
  content = content.replace(/```json/g, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    logger.error({ content, err: e.message }, "Failed to parse LLM JSON for skill tree");
    throw new ApiError(500, "Failed to generate a valid skill tree format");
  }

  logger.info({ parsed, uniqueVideoIds }, "LLM Skill Tree Output");

  const owner = req.user?._id; 
  if (!owner) throw new ApiError(401, "Must be logged in to save skill tree");

  const returnedIds = Array.isArray(parsed.videoIds) ? parsed.videoIds : [];
  // Also stringify uniqueVideoIds to ensure strict string matching
  const stringUniqueIds = uniqueVideoIds.map(String);
  const validIds = returnedIds.filter(id => stringUniqueIds.includes(String(id)));

  if (validIds.length === 0) {
    logger.warn({ returnedIds, stringUniqueIds }, "AI returned no valid IDs");
    throw new ApiError(404, `Our AI couldn't find any videos related to '${topic}'. Try a different topic!`);
  }

  const playlist = await Playlist.create({
    name: parsed.title || `Skill Tree: ${topic}`,
    description: parsed.description || `An AI-generated learning path for ${topic}`,
    videos: validIds,
    owner: owner
  });

  return res.status(201).json(
    new ApiResponse(201, playlist, "Dynamic Skill Tree generated successfully")
  );
});

export { askQuestion, getTranscript, getAiStatus, generateSkillTree };

/**
 * Phase 5: Knowledge graph extraction & chapter generation service.
 *
 * Uses Groq LLM (Llama 3.3 70B) to:
 * 1. Extract key concepts and their relationships from a transcript
 * 2. Generate timestamped chapters based on topic shifts
 */
import { getGroqClient } from "../config/groq.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Extract knowledge graph concepts from a transcript.
 *
 * @param {string} transcriptText - Full transcript text
 * @returns {Promise<Array<{name: string, related: Array<{name: string, relationship: string}>}>>}
 */
export async function extractConcepts(transcriptText) {
  const groq = getGroqClient();
  if (!groq) return [];

  // Truncate very long transcripts to avoid token limits
  const maxChars = 12000;
  const truncated = transcriptText.length > maxChars
    ? transcriptText.slice(0, maxChars) + "..."
    : transcriptText;

  try {
    const response = await groq.chat.completions.create({
      model: config.groq.chatModel,
      messages: [
        {
          role: "system",
          content: `You are a knowledge extraction AI. Extract the key technical concepts, topics, and entities from the provided transcript and identify relationships between them.

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
[
  {
    "name": "Concept Name",
    "related": [
      { "name": "Related Concept", "relationship": "describes/uses/requires/is-part-of/explains" }
    ]
  }
]

Rules:
- Extract 5-15 key concepts maximum
- Focus on technical terms, frameworks, patterns, and key ideas
- Relationships should be meaningful (not just "mentioned with")
- Keep concept names concise (1-3 words)`,
        },
        {
          role: "user",
          content: `Extract key concepts and relationships from this transcript:\n\n${truncated}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "[]";
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON array from the response
      const match = content.match(/\[[\s\S]*\]/);
      parsed = match ? JSON.parse(match[0]) : [];
    }

    // Handle both { concepts: [...] } and [...] formats
    const concepts = Array.isArray(parsed) ? parsed : (parsed.concepts || parsed.data || []);

    logger.info({ conceptCount: concepts.length }, "Knowledge graph concepts extracted");
    return concepts;
  } catch (err) {
    logger.warn({ err: err.message }, "Knowledge graph extraction failed");
    return [];
  }
}

/**
 * Generate timestamped chapter markers from transcript segments.
 *
 * @param {Array<{start: number, end: number, text: string}>} segments - Whisper segments
 * @returns {Promise<Array<{title: string, startTime: number}>>}
 */
export async function generateChapters(segments) {
  const groq = getGroqClient();
  if (!groq || segments.length === 0) return [];

  // Build a condensed timestamped transcript
  const condensed = segments
    .map((s) => `[${formatTime(s.start)}] ${s.text}`)
    .join("\n");

  // Truncate if too long
  const maxChars = 12000;
  const truncated = condensed.length > maxChars
    ? condensed.slice(0, maxChars) + "\n..."
    : condensed;

  try {
    const response = await groq.chat.completions.create({
      model: config.groq.chatModel,
      messages: [
        {
          role: "system",
          content: `You are a video chapter generator. Analyze the timestamped transcript and identify major topic shifts to create chapter markers.

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
[
  { "title": "Chapter Title", "startTime": 0 },
  { "title": "Chapter Title", "startTime": 125.5 }
]

Rules:
- The first chapter should always start at time 0 (the intro)
- Create 3-8 chapters depending on video length
- Chapter titles should be descriptive but concise (3-6 words)
- startTime is in seconds (decimal allowed)
- Space chapters logically based on topic shifts, not evenly`,
        },
        {
          role: "user",
          content: `Generate chapters for this video transcript:\n\n${truncated}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "[]";
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      parsed = match ? JSON.parse(match[0]) : [];
    }

    const chapters = Array.isArray(parsed) ? parsed : (parsed.chapters || parsed.data || []);

    // Validate and sort by startTime
    const valid = chapters
      .filter((c) => c.title && typeof c.startTime === "number")
      .sort((a, b) => a.startTime - b.startTime);

    logger.info({ chapterCount: valid.length }, "Chapters generated");
    return valid;
  } catch (err) {
    logger.warn({ err: err.message }, "Chapter generation failed");
    return [];
  }
}

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

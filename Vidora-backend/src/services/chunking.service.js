/**
 * Phase 5: Transcript chunking service.
 *
 * Takes timestamped Whisper segments and merges them into ~200-word chunks
 * with 50-word overlap to preserve context across chunk boundaries.
 * Each chunk retains its start and end timestamps for citation.
 */
import { logger } from "../utils/logger.js";

const TARGET_CHUNK_WORDS = 200;
const OVERLAP_WORDS = 50;

/**
 * Chunk a transcript into overlapping segments for embedding.
 *
 * @param {Array<{start: number, end: number, text: string}>} segments - Whisper segments
 * @returns {Array<{index: number, text: string, startTime: number, endTime: number}>}
 */
export function chunkTranscript(segments) {
  if (!segments || segments.length === 0) return [];

  // 1. Flatten all segments into a list of words with timestamps
  const words = [];
  for (const seg of segments) {
    const segWords = seg.text.split(/\s+/).filter(Boolean);
    const timePerWord = segWords.length > 0 ? (seg.end - seg.start) / segWords.length : 0;

    for (let i = 0; i < segWords.length; i++) {
      words.push({
        word: segWords[i],
        time: seg.start + i * timePerWord,
      });
    }
  }

  if (words.length === 0) return [];

  // 2. Build chunks with overlap
  const chunks = [];
  let chunkStart = 0;

  while (chunkStart < words.length) {
    const chunkEnd = Math.min(chunkStart + TARGET_CHUNK_WORDS, words.length);
    const chunkWords = words.slice(chunkStart, chunkEnd);

    if (chunkWords.length === 0) break;

    chunks.push({
      index: chunks.length,
      text: chunkWords.map((w) => w.word).join(" "),
      startTime: Math.round(chunkWords[0].time * 100) / 100,
      endTime: Math.round(chunkWords[chunkWords.length - 1].time * 100) / 100,
    });

    // Advance by (TARGET - OVERLAP) words, ensuring we don't go backwards
    const advance = Math.max(TARGET_CHUNK_WORDS - OVERLAP_WORDS, 1);
    chunkStart += advance;
  }

  logger.info(
    { totalWords: words.length, chunkCount: chunks.length, overlap: OVERLAP_WORDS },
    "Transcript chunked"
  );

  return chunks;
}

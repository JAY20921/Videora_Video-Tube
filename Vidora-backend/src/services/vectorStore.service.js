/**
 * Phase 5: Vector store service.
 *
 * Interfaces with Qdrant to store and query transcript chunk embeddings.
 * Supports scoped searches (per-video) for the RAG Tutor.
 */
import { getQdrantClient, ensureCollection } from "../config/qdrant.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

/**
 * Generate a deterministic UUID v4 from a string seed.
 * This ensures the same chunk always maps to the same Qdrant point ID.
 */
function deterministicUUID(seed) {
  const hash = crypto.createHash("md5").update(seed).digest("hex");
  // Format as UUID: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),           // version 4
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variant
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Store transcript chunks and their embeddings in Qdrant.
 *
 * @param {string} videoId - MongoDB Video._id
 * @param {Array<{index: number, text: string, startTime: number, endTime: number}>} chunks
 * @param {number[][]} embeddings - Embedding vectors (same order as chunks)
 * @returns {Promise<string[]>} Array of Qdrant point IDs
 */
export async function storeChunks(videoId, chunks, embeddings) {
  const ready = await ensureCollection();
  if (!ready) throw new Error("Qdrant collection not available");

  const client = getQdrantClient();
  const collectionName = config.qdrant.collectionName;

  const points = chunks.map((chunk, i) => {
    const pointId = deterministicUUID(`${videoId}-chunk-${chunk.index}`);
    return {
      id: pointId,
      vector: embeddings[i],
      payload: {
        videoId: String(videoId),
        chunkIndex: chunk.index,
        text: chunk.text,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
      },
    };
  });

  // Qdrant supports batch upsert
  await client.upsert(collectionName, {
    wait: true,
    points,
  });

  const pointIds = points.map((p) => p.id);
  logger.info({ videoId, pointCount: pointIds.length }, "Chunks stored in Qdrant");

  return pointIds;
}

/**
 * Semantic search for chunks similar to a query vector.
 * Optionally scoped to a specific video.
 *
 * @param {number[]} queryVector - Embedding of the user's question
 * @param {string} [videoId] - Optional: restrict search to this video
 * @param {number} [topK=5] - Number of results to return
 * @returns {Promise<Array<{text: string, startTime: number, endTime: number, score: number, videoId: string}>>}
 */
export async function searchSimilar(queryVector, videoId = null, topK = 5) {
  const ready = await ensureCollection();
  if (!ready) return [];

  const client = getQdrantClient();
  const collectionName = config.qdrant.collectionName;

  const searchParams = {
    vector: queryVector,
    limit: topK,
    with_payload: true,
  };

  // Scope to a specific video if provided
  if (videoId) {
    searchParams.filter = {
      must: [{ key: "videoId", match: { value: String(videoId) } }],
    };
  }

  const results = await client.search(collectionName, searchParams);

  return results.map((r) => ({
    text: r.payload.text,
    startTime: r.payload.startTime,
    endTime: r.payload.endTime,
    score: r.score,
    videoId: r.payload.videoId,
    chunkIndex: r.payload.chunkIndex,
  }));
}

/**
 * Delete all vectors for a specific video.
 * Called when a video is deleted.
 *
 * @param {string} videoId
 */
export async function deleteVideoVectors(videoId) {
  const client = getQdrantClient();
  if (!client) return;

  const collectionName = config.qdrant.collectionName;

  try {
    await client.delete(collectionName, {
      wait: true,
      filter: {
        must: [{ key: "videoId", match: { value: String(videoId) } }],
      },
    });
    logger.info({ videoId }, "Video vectors deleted from Qdrant");
  } catch (err) {
    logger.warn({ err: err.message, videoId }, "Failed to delete video vectors from Qdrant");
  }
}

/**
 * Phase 5: Embedding generation service (Cloud-only).
 *
 * Generates vector embeddings for text chunks using HuggingFace Inference API.
 * Offloads CPU processing from the server to run efficiently on Render's free tier.
 * Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
 *
 * IMPORTANT: The local Xenova fallback has been REMOVED because it loads a ~400MB
 * ML model into RAM which causes OOM crashes on Render's 512MB free tier.
 * If the cloud API is unavailable, we use zero-vector placeholders instead.
 * The video still works — just semantic search won't match for those chunks.
 */
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const MODEL_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const HF_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL_ID}`;
const BATCH_SIZE = 32;
const EMBEDDING_DIMS = 384;

/**
 * Fetch embeddings with auto-retry for model cold starts.
 * Uses AbortController to enforce a 30s timeout per request.
 */
async function fetchEmbeddingsWithRetry(texts, retries = 3) {
  if (!config.huggingFace.token) {
    throw new Error("HF_TOKEN is not set in environment variables");
  }

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(HF_API_URL, {
        headers: {
          Authorization: `Bearer ${config.huggingFace.token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: texts }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = await response.json();

      if (response.ok) {
        return result;
      }

      // Handle Hugging Face cold start "model is currently loading" error
      if (result.error && result.error.includes("currently loading")) {
        const waitTime = Math.min((result.estimated_time || 20) * 1000, 60000); // cap at 60s
        logger.warn(`HuggingFace model is loading. Retrying in ${Math.round(waitTime / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw new Error(`HuggingFace API error: ${JSON.stringify(result)}`);
    } catch (err) {
      clearTimeout(timeout);

      if (err.name === "AbortError") {
        logger.warn({ attempt: i + 1 }, "HuggingFace API request timed out (30s)");
        if (i < retries - 1) continue;
        throw new Error("HuggingFace API timed out after all retries");
      }

      // For network errors, retry
      if (i < retries - 1 && (err.message.includes("fetch failed") || err.message.includes("network"))) {
        logger.warn({ err: err.message, attempt: i + 1 }, "HuggingFace API network error, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 3000 * (i + 1))); // backoff
        continue;
      }

      throw err;
    }
  }
  throw new Error("HuggingFace API failed after retries");
}

/**
 * Generate embeddings for an array of text strings.
 *
 * Falls back to zero-vector placeholders if the cloud API is unavailable.
 * This prevents OOM crashes from loading the local Xenova model (~400MB RAM).
 *
 * @param {string[]} texts - Array of text chunks to embed
 * @returns {Promise<number[][]>} Array of embedding vectors (each is float[384])
 */
export async function embedTexts(texts) {
  if (!texts || texts.length === 0) return [];

  const allEmbeddings = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const batchEmbeddings = await fetchEmbeddingsWithRetry(batch);

      // If HF returns a 1D array for a single input, wrap it
      if (batch.length === 1 && typeof batchEmbeddings[0] === 'number') {
        allEmbeddings.push(batchEmbeddings);
      } else {
        allEmbeddings.push(...batchEmbeddings);
      }

      logger.debug(
        { batch: `${i + 1}-${i + batch.length}`, total: texts.length },
        "Cloud embedding batch processed"
      );
    } catch (err) {
      // ═══════════════════════════════════════════════════════════════════
      // CRITICAL FIX: Use zero-vector placeholders instead of Xenova local
      // model. The Xenova model loads ~400MB into RAM and causes OOM crashes
      // on Render's 512MB free tier, killing the entire server process.
      // Zero vectors mean semantic search won't work for these chunks,
      // but the video, transcript, chapters, and knowledge graph all still
      // function perfectly. Embeddings can be regenerated later.
      // ═══════════════════════════════════════════════════════════════════
      logger.warn(
        { err: err.message, batch: `${i + 1}-${i + batch.length}` },
        "Cloud embedding failed — using zero-vector placeholders (Xenova local disabled to prevent OOM)"
      );

      for (let j = 0; j < batch.length; j++) {
        allEmbeddings.push(new Array(EMBEDDING_DIMS).fill(0));
      }
    }
  }

  logger.info({ count: allEmbeddings.length, dims: allEmbeddings[0]?.length }, "All embeddings generated");
  return allEmbeddings;
}

/**
 * Generate a single embedding for a query string.
 * Used for the RAG tutor's question embedding.
 *
 * @param {string} text - The query text
 * @returns {Promise<number[]>} Embedding vector (384 dims)
 */
export async function embedQuery(text) {
  const results = await embedTexts([text]);
  return results[0];
}

/**
 * Phase 5: Embedding generation service (Cloud-only).
 *
 * Generates vector embeddings for text chunks using the official
 * @huggingface/inference SDK which auto-selects the best available
 * inference provider (Serverless, Dedicated, etc.).
 *
 * Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
 *
 * IMPORTANT: The local Xenova fallback has been REMOVED because it loads a ~400MB
 * ML model into RAM which causes OOM crashes on Render's 512MB free tier.
 * The raw fetch to api-inference.huggingface.co has also been replaced with the
 * official SDK because that domain is unreachable from some networks/ISPs.
 */
import { HfInference } from "@huggingface/inference";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const MODEL_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const BATCH_SIZE = 32;

let _hf = null;

/**
 * Get or create the HuggingFace Inference client singleton.
 */
function getHfClient() {
  if (!_hf) {
    if (!config.huggingFace.token) {
      throw new Error("HF_TOKEN is not set in environment variables");
    }
    _hf = new HfInference(config.huggingFace.token);
    logger.info("HuggingFace Inference client initialized");
  }
  return _hf;
}

/**
 * Fetch embeddings for a batch of texts with auto-retry.
 * Uses the official HF SDK which handles provider selection and routing.
 */
async function fetchEmbeddingsWithRetry(texts, retries = 3) {
  const hf = getHfClient();

  for (let i = 0; i < retries; i++) {
    try {
      // The SDK returns a number[] for single input, number[][] for batch
      const result = await hf.featureExtraction({
        model: MODEL_ID,
        inputs: texts,
      });

      return result;
    } catch (err) {
      const errMsg = err.message || String(err);

      // Handle HuggingFace cold start "model is currently loading" error
      if (errMsg.includes("currently loading") || errMsg.includes("loading")) {
        const waitTime = Math.min(20000, 60000); // 20s default, cap at 60s
        logger.warn(`HuggingFace model is loading. Retrying in ${Math.round(waitTime / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // For network / transient errors, retry with backoff
      if (i < retries - 1) {
        const backoff = 3000 * (i + 1);
        logger.warn({ err: errMsg, attempt: i + 1 }, `HuggingFace API error, retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
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
      const batchResult = await fetchEmbeddingsWithRetry(batch);

      // Normalize the result shape:
      // - Single text: SDK may return a flat number[] → wrap it
      // - Multiple texts: SDK returns number[][] → use as-is
      if (batch.length === 1 && typeof batchResult[0] === "number") {
        allEmbeddings.push(batchResult);
      } else {
        allEmbeddings.push(...batchResult);
      }

      logger.debug(
        { batch: `${i + 1}-${i + batch.length}`, total: texts.length },
        "Cloud embedding batch processed"
      );
    } catch (err) {
      logger.error(
        { err: err.message, batch: `${i + 1}-${i + batch.length}`, total: texts.length },
        "Embedding generation failed"
      );
      // Let the error propagate to the AI worker, which will mark
      // the job as failed and set aiStatus = "failed" in MongoDB.
      // The video itself remains playable — only AI features are skipped.
      throw err;
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

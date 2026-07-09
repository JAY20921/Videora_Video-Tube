/**
 * Phase 5: Embedding generation service (Cloud).
 *
 * Generates vector embeddings for text chunks using HuggingFace Inference API.
 * Offloads CPU processing from the server to run efficiently on Render's free tier.
 * Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
 */
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const MODEL_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
const HF_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL_ID}`;
const BATCH_SIZE = 32;

let _localPipelinePromise = null;
async function getLocalPipeline() {
  if (!_localPipelinePromise) {
    logger.info("Initializing local Xenova fallback model...");
    const { pipeline } = await import("@xenova/transformers");
    _localPipelinePromise = pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
      quantized: true,
    });
  }
  return _localPipelinePromise;
}

/**
 * Fetch embeddings with auto-retry for model cold starts
 */
async function fetchEmbeddingsWithRetry(texts, retries = 3) {
  if (!config.huggingFace.token) {
    throw new Error("HF_TOKEN is not set in environment variables");
  }

  for (let i = 0; i < retries; i++) {
    const response = await fetch(HF_API_URL, {
      headers: {
        Authorization: `Bearer ${config.huggingFace.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ inputs: texts }),
    });

    const result = await response.json();

    if (response.ok) {
      return result;
    }

    // Handle Hugging Face cold start "model is currently loading" error
    if (result.error && result.error.includes("currently loading")) {
      const waitTime = (result.estimated_time || 20) * 1000;
      logger.warn(`HuggingFace model is loading. Retrying in ${Math.round(waitTime/1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    throw new Error(`HuggingFace API error: ${JSON.stringify(result)}`);
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
      logger.warn({ err: err.message, batch: `${i + 1}-${i + batch.length}` },
        "Cloud embedding failed, falling back to local Xenova model..."
      );
      try {
        const extractor = await getLocalPipeline();
        const output = await extractor(batch, { pooling: "mean", normalize: true });
        const batchEmbeddings = batch.length === 1 ? [output.tolist()[0]] : output.tolist();
        allEmbeddings.push(...batchEmbeddings);
      } catch (localErr) {
        logger.error({ err: localErr.message }, "Local fallback also failed. Using zero embeddings.");
        for (let j = 0; j < batch.length; j++) {
          allEmbeddings.push(new Array(384).fill(0));
        }
      }
    }
  }

  logger.info({ count: allEmbeddings.length, dims: allEmbeddings[0]?.length }, "All cloud embeddings generated");
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

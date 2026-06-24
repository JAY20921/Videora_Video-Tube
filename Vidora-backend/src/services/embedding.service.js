/**
 * Phase 5: Embedding generation service.
 *
 * Generates vector embeddings for text chunks using an OpenAI-compatible API.
 * Uses Groq or OpenAI's text-embedding model.
 * Batches requests to respect rate limits.
 */
import OpenAI from "openai";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

// Use OpenAI for embeddings (Groq doesn't support embeddings yet)
// Falls back to a lightweight approach if no API key is available
let _embeddingClient = null;

function getEmbeddingClient() {
  if (!_embeddingClient) {
    // Try OpenAI API key first (for embeddings), then fall back to Groq
    const apiKey = process.env.OPENAI_API_KEY || config.groq.apiKey;
    const baseURL = process.env.OPENAI_API_KEY
      ? "https://api.openai.com/v1"
      : config.groq.baseUrl;

    if (!apiKey) return null;

    _embeddingClient = new OpenAI({ apiKey, baseURL });
  }
  return _embeddingClient;
}

const BATCH_SIZE = 20; // Max texts per embedding request

/**
 * Generate embeddings for an array of text strings.
 *
 * @param {string[]} texts - Array of text chunks to embed
 * @returns {Promise<number[][]>} Array of embedding vectors (each is float[1536])
 */
export async function embedTexts(texts) {
  const client = getEmbeddingClient();

  if (!client) {
    logger.warn("No embedding API available — generating placeholder embeddings");
    return texts.map(() => generateSimpleEmbedding(""));
  }

  const allEmbeddings = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await client.embeddings.create({
        model: config.groq.embeddingModel,
        input: batch,
      });

      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      allEmbeddings.push(...batchEmbeddings);

      logger.debug(
        { batch: `${i + 1}-${i + batch.length}`, total: texts.length },
        "Embedding batch processed"
      );
    } catch (err) {
      // If embedding API fails, fall back to simple hash-based embeddings
      logger.warn({ err: err.message, batch: `${i + 1}-${i + batch.length}` },
        "Embedding API failed — using fallback embeddings"
      );
      for (const text of batch) {
        allEmbeddings.push(generateSimpleEmbedding(text));
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
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
 * @returns {Promise<number[]>} Embedding vector
 */
export async function embedQuery(text) {
  const results = await embedTexts([text]);
  return results[0];
}

/**
 * Fallback: Generate a simple deterministic embedding from text.
 * Not semantically meaningful but allows the system to function
 * without an embedding API during development.
 */
function generateSimpleEmbedding(text) {
  const dims = 1536;
  const embedding = new Array(dims).fill(0);

  // Simple hash-based approach
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    embedding[i % dims] += charCode / 1000;
    embedding[(i * 7 + 3) % dims] += Math.sin(charCode) * 0.1;
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
  return embedding.map((v) => v / magnitude);
}

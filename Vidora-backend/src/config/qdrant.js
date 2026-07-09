/**
 * Phase 5: Qdrant vector database client — lazy-loaded.
 *
 * Stores transcript chunk embeddings for RAG (Retrieval-Augmented Generation).
 * The collection is auto-created on first use with the correct vector dimensions.
 */
import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./index.js";
import { logger } from "../utils/logger.js";

let _client = null;
let _collectionReady = false;

// Embedding dimension — must match the model used in embedding.service.js
// Xenova all-MiniLM-L6-v2 = 384 dimensions
export const VECTOR_SIZE = 384;

/**
 * Get (or create) the Qdrant client singleton.
 * Returns null if QDRANT_URL is not configured.
 */
export function getQdrantClient() {
  if (!config.qdrant.url) {
    logger.warn("QDRANT_URL not set — vector search disabled");
    return null;
  }

  if (!_client) {
    _client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey || undefined,
    });
    logger.info({ url: config.qdrant.url }, "Qdrant client initialized");
  }

  return _client;
}

/**
 * Ensure the transcript collection exists in Qdrant.
 * Creates it with the correct vector config if missing.
 * Idempotent — safe to call on every worker startup.
 */
export async function ensureCollection() {
  const client = getQdrantClient();
  if (!client) return false;

  if (_collectionReady) return true;

  const name = config.qdrant.collectionName;

  try {
    const collections = await client.getCollections();
    let exists = collections.collections.some((c) => c.name === name);

    if (exists) {
      try {
        const info = await client.getCollection(name);
        const currentSize = info.config?.params?.vectors?.size || info.params?.vectors?.size || 1536;
        if (currentSize !== VECTOR_SIZE) {
          logger.warn({ oldSize: currentSize, newSize: VECTOR_SIZE }, "Qdrant dimension mismatch! Recreating collection...");
          await client.deleteCollection(name);
          exists = false;
        }
      } catch (err) {
        // Assume exists and let it fail gracefully on insert if wrong
      }
    }

    if (!exists) {
      await client.createCollection(name, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
        // Optimized for filtering by videoId
        optimizers_config: {
          default_segment_number: 2,
        },
      });

      // Create a payload index on videoId for fast filtered searches
      await client.createPayloadIndex(name, {
        field_name: "videoId",
        field_schema: "keyword",
      });

      logger.info({ collection: name, vectorSize: VECTOR_SIZE }, "Qdrant collection created");
    }

    _collectionReady = true;
    return true;
  } catch (err) {
    logger.error({ err: err.message }, "Failed to ensure Qdrant collection");
    return false;
  }
}

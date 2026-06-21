/**
 * Phase 4: Meilisearch client — lazy-loaded.
 *
 * Same pattern as the Redis config: the client is only instantiated
 * when the first search operation is attempted, preventing startup
 * errors when Meilisearch is not running.
 */
import { Meilisearch } from "meilisearch";
import { config } from "./index.js";
import { logger } from "../utils/logger.js";

let client = null;
let indexReady = false;

/**
 * Get (or create) the Meilisearch client singleton.
 * Returns null if MEILI_HOST is not configured.
 */
export function getMeiliClient() {
  if (!config.meilisearch.host) return null;

  if (!client) {
    client = new Meilisearch({
      host: config.meilisearch.host,
      apiKey: config.meilisearch.apiKey || undefined,
    });
    logger.info({ host: config.meilisearch.host }, "Meilisearch client created");
  }
  return client;
}

/**
 * Get the `videos` index, creating it and configuring settings if needed.
 * Returns null if Meilisearch is not available.
 */
export async function getVideosIndex() {
  const meili = getMeiliClient();
  if (!meili) return null;

  try {
    const index = meili.index("videos");

    if (!indexReady) {
      // Create index if it doesn't exist (idempotent)
      try {
        await meili.createIndex("videos", { primaryKey: "id" });
      } catch {
        // Index may already exist — that's fine
      }

      // Configure searchable & displayed attributes
      await index.updateSettings({
        searchableAttributes: ["title", "description", "ownerName"],
        displayedAttributes: [
          "id", "title", "description", "thumbnail", "duration",
          "views", "ownerName", "ownerUsername", "ownerAvatar",
          "ownerId", "createdAt",
        ],
        // Typo tolerance: 1 typo for words 5+ chars, 2 for 9+
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: {
            oneTypo: 5,
            twoTypos: 9,
          },
        },
        // Ranking rules
        rankingRules: [
          "words",
          "typo",
          "proximity",
          "attribute",
          "sort",
          "exactness",
        ],
        sortableAttributes: ["createdAt", "views"],
      });

      indexReady = true;
      logger.info("Meilisearch 'videos' index configured");
    }

    return index;
  } catch (err) {
    logger.warn({ err: err.message }, "Meilisearch index unavailable");
    return null;
  }
}

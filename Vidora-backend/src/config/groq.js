/**
 * Phase 5: Groq AI client — lazy-loaded.
 *
 * Uses the OpenAI SDK pointed at Groq's API endpoint.
 * This gives us access to:
 *   - Whisper Large V3 Turbo (transcription)
 *   - Llama 3.3 70B Versatile (chat / knowledge extraction)
 *
 * Same lazy-init pattern as Redis and Meilisearch clients.
 */
import OpenAI from "openai";
import { config } from "./index.js";
import { logger } from "../utils/logger.js";

let _client = null;

/**
 * Get (or create) the Groq-backed OpenAI client singleton.
 * Returns null if GROQ_API_KEY is not configured.
 */
export function getGroqClient() {
  if (!config.groq.apiKey) {
    logger.warn("GROQ_API_KEY not set — AI features disabled");
    return null;
  }

  if (!_client) {
    _client = new OpenAI({
      apiKey: config.groq.apiKey,
      baseURL: config.groq.baseUrl,
    });
    logger.info("Groq AI client initialized");
  }

  return _client;
}

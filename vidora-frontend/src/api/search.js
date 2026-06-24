// src/api/search.js
import api from "./client";

/**
 * Phase 4: Instant search via Meilisearch backend.
 * Returns { hits, query, totalHits, processingTimeMs, source }.
 */
export const instantSearch = async (query, limit = 8) => {
  if (!query?.trim()) return { hits: [], query: "", totalHits: 0, processingTimeMs: 0 };

  const res = await api.get("/search", {
    params: { q: query.trim(), limit },
  });

  return res?.data?.data ?? res?.data ?? { hits: [], query, totalHits: 0 };
};

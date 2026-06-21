/**
 * Phase 4: Search controller.
 *
 * Queries Meilisearch for instant, typo-tolerant search.
 * Falls back to MongoDB $text search if Meilisearch is unavailable.
 */
import mongoose from "mongoose";
import { getVideosIndex } from "../config/meilisearch.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

export const instantSearch = asyncHandler(async (req, res) => {
  const { q = "", limit = 10, offset = 0 } = req.query;

  if (!q.trim()) {
    return res.status(200).json(
      new ApiResponse(200, { hits: [], query: q, totalHits: 0, processingTimeMs: 0 }, "Empty query")
    );
  }

  const perPage = Math.min(parseInt(limit, 10) || 10, 50);
  const skip = parseInt(offset, 10) || 0;

  // ── Try Meilisearch first ──────────────────────────────────────────────────
  try {
    const index = await getVideosIndex();

    if (index) {
      const results = await index.search(q.trim(), {
        limit: perPage,
        offset: skip,
        attributesToHighlight: ["title", "description"],
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
        attributesToCrop: ["description"],
        cropLength: 60,
      });

      return res.status(200).json(
        new ApiResponse(200, {
          hits: results.hits,
          query: results.query,
          totalHits: results.estimatedTotalHits || results.totalHits || results.hits.length,
          processingTimeMs: results.processingTimeMs,
          source: "meilisearch",
        }, "Search results")
      );
    }
  } catch (err) {
    logger.warn({ err: err.message }, "Meilisearch search failed — falling back to MongoDB");
  }

  // ── Fallback: MongoDB $text search ────────────────────────────────────────
  const filter = { isPublished: true, $text: { $search: q.trim() } };

  const startMs = Date.now();
  const videos = await Video.find(filter)
    .populate({ path: "owner", select: "fullName username avatar" })
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(perPage)
    .lean();

  const total = await Video.countDocuments(filter);
  const elapsed = Date.now() - startMs;

  // Normalize MongoDB results to match Meilisearch shape
  const hits = videos.map((v) => ({
    id: String(v._id),
    title: v.title,
    description: v.description,
    thumbnail: v.thumbnail,
    duration: v.duration,
    views: v.views,
    ownerName: v.owner?.fullName || v.owner?.username || "",
    ownerUsername: v.owner?.username || "",
    ownerAvatar: v.owner?.avatar || "",
    ownerId: String(v.owner?._id || v.owner),
    createdAt: new Date(v.createdAt).getTime(),
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      hits,
      query: q.trim(),
      totalHits: total,
      processingTimeMs: elapsed,
      source: "mongodb",
    }, "Search results (fallback)")
  );
});

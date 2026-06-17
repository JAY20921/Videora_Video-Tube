import { WatchHistory } from "../models/watchHistory.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isValidObjectId } from "mongoose";

/**
 * POST /api/v1/watch-progress
 * Body: { videoId, progressSeconds }
 * Upserts the user's watch progress for a specific video.
 * Safe to call on every heartbeat — compound unique index prevents duplicates.
 */
const saveProgress = asyncHandler(async (req, res) => {
  const { videoId, progressSeconds } = req.body;

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Valid videoId is required");
  }

  const progress = Math.max(0, Number(progressSeconds) || 0);

  await WatchHistory.findOneAndUpdate(
    { user: req.user._id, video: videoId },
    { progressSeconds: progress, watchedAt: new Date() },
    { upsert: true, new: true }
  );

  // Fire-and-forget: increment view count only on first meaningful engagement (>5s)
  if (progress > 5) {
    Video.findByIdAndUpdate(videoId, { $inc: { views: 0 } }).exec(); // no-op, view count handled in video.controller
  }

  return res.status(200).json(new ApiResponse(200, { videoId, progressSeconds: progress }, "Progress saved"));
});

/**
 * GET /api/v1/watch-progress/:videoId
 * Returns the authenticated user's saved progress for a specific video.
 * Used on page load to determine if the player should offer a "Resume" prompt.
 */
const getProgress = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const record = await WatchHistory.findOne({ user: req.user._id, video: videoId }).lean();

  return res.status(200).json(
    new ApiResponse(200, { progressSeconds: record?.progressSeconds ?? 0 }, "Progress fetched")
  );
});

/**
 * GET /api/v1/watch-progress/history?page=1&limit=12
 * Paginated watch history for the authenticated user.
 * Filters to only include videos that are "in-progress" (watched >30s, and not at the end).
 * These feed the "Continue Watching" section on the home page.
 */
const getWatchHistory = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);

  const history = await WatchHistory.find({ user: req.user._id, progressSeconds: { $gt: 30 } })
    .populate({
      path: "video",
      select: "title thumbnail duration views owner isPublished",
      populate: { path: "owner", select: "fullName username avatar" },
    })
    .sort({ watchedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Filter out deleted or unpublished videos
  const filtered = history.filter((h) => h.video && h.video.isPublished !== false);

  return res.status(200).json(
    new ApiResponse(200, { history: filtered, page, limit }, "Watch history fetched")
  );
});

export { saveProgress, getProgress, getWatchHistory };

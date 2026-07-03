import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { WatchHistory } from "../models/watchHistory.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getVideoQueue } from "../queues/videoQueue.js";
import { syncVideoToSearch, removeVideoFromSearch } from "../services/searchSync.js";
import { logger } from "../utils/logger.js";
import { getRedisClient } from "../config/redis.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.max(parseInt(limit, 10) || 10, 1);

  const filter = { isPublished: true };

  // Phase 0: use $text index instead of $regex
  if (query && query.trim()) {
    filter.$text = { $search: query.trim() };
  }

  if (userId) {
    if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");
    filter.owner = new mongoose.Types.ObjectId(userId);
  }

  const sortDirection = sortType === "asc" ? 1 : -1;
  const sortObj = {};
  // If text search, also sort by text score
  if (query && query.trim()) {
    sortObj.score = { $meta: "textScore" };
  }
  sortObj[sortBy] = sortDirection;

  const total = await Video.countDocuments(filter);
  const videos = await Video.find(filter)
    .populate({ path: "owner", select: "fullName username avatar" })
    .sort(sortObj)
    .skip((pageNum - 1) * perPage)
    .limit(perPage)
    .lean();

  const totalPages = Math.ceil(total / perPage) || 1;

  return res.status(200).json(
    new ApiResponse(
      200,
      { videos, meta: { total, page: pageNum, limit: perPage, totalPages } },
      "Videos fetched successfully"
    )
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  // title + description already validated by Zod middleware
  const { title, description } = req.body;

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  if (!videoLocalPath) throw new ApiError(400, "Video file is required");

  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  const uploadedVideo = await uploadOnCloudinary(videoLocalPath, "videos");
  if (!uploadedVideo?.url) throw new ApiError(500, "Error uploading video");

  let uploadedThumbnail = null;
  if (thumbnailLocalPath) {
    uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath, "thumbnails");
    if (!uploadedThumbnail?.url) throw new ApiError(500, "Error uploading thumbnail");
  }

  // Extract duration from Cloudinary response
  const duration = uploadedVideo.duration || 0;

  // Auto-generate thumbnail from the video if the user didn't upload one
  // Cloudinary automatically returns a frame from the video if we request a .jpg
  let finalThumbnail = uploadedThumbnail?.url;
  if (!finalThumbnail && uploadedVideo.url) {
    finalThumbnail = uploadedVideo.url.replace(/\.[^/.]+$/, ".jpg");
  }

  // Phase 3: Mark video as "processing" — the worker will update to "ready" after HLS transcoding
  const newVideo = await Video.create({
    title: title.trim(),
    description: description.trim(),
    duration,
    videoFile: uploadedVideo.url,
    thumbnail: finalThumbnail || "",
    owner: req.user._id,
    status: "processing",
  });

  // Enqueue the video for HLS transcoding via BullMQ with a 2-second timeout
  try {
    const enqueuePromise = getVideoQueue().add(
      "transcode",
      {
        videoId: String(newVideo._id),
        rawUrl: uploadedVideo.url,
        title: title.trim(),
        duration: Math.round(duration)
      },
      { jobId: `transcode-${newVideo._id}` }
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
    );

    await Promise.race([enqueuePromise, timeoutPromise]);
    logger.info({ videoId: newVideo._id }, "Video transcoding job enqueued");
  } catch (queueError) {
    // If Redis/queue is unavailable, fall back to "ready" with raw MP4
    logger.warn({ err: queueError, videoId: newVideo._id }, "Queue unavailable — video set to ready with raw MP4");
    newVideo.status = "ready";
    await newVideo.save();
  }

  const created = await Video.findById(newVideo._id)
    .populate({ path: "owner", select: "fullName username avatar" })
    .select("-__v");

  return res.status(201).json(new ApiResponse(201, created, "Video published — processing will complete shortly"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId)
    .populate({ path: "owner", select: "fullName username avatar" })
    .lean();

  if (!video) throw new ApiError(404, "Video not found");

  // Fetch subscribers count
  const subscribersCount = await Subscription.countDocuments({ channel: video.owner._id });
  video.subscribersCount = subscribersCount;

  // Fetch if current user is subscribed
  if (req.user?._id) {
    const isSubscribed = await Subscription.exists({
      subscriber: req.user._id,
      channel: video.owner._id
    });
    video.isSubscribed = !!isSubscribed;
  } else {
    video.isSubscribed = false;
  }

  // Fetch likes count and if current user liked it
  const likesCount = await Like.countDocuments({ video: videoId });
  video.likesCount = likesCount;

  if (req.user?._id) {
    const isLiked = await Like.exists({
      video: videoId,
      likedBy: req.user._id
    });
    video.isLiked = !!isLiked;
  } else {
    video.isLiked = false;
  }

  return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
});

const incrementVideoView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const redis = getRedisClient();
  const identifier = req.user?._id || req.ip || req.headers["x-forwarded-for"] || "anonymous";
  const viewKey = `view:${videoId}:${identifier}`;

  // Check if this user/IP has viewed this video in the last 1 hour
  const hasViewed = await redis.get(viewKey);

  let video;

  if (hasViewed) {
    // Already viewed recently, just fetch the video without incrementing
    video = await Video.findById(videoId)
      .populate({ path: "owner", select: "fullName username avatar" })
      .lean();
  } else {
    // New view, increment count and set Redis key for 1 hour (3600 seconds)
    video = await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }, { new: true })
      .populate({ path: "owner", select: "fullName username avatar" })
      .lean();
    
    if (video) {
      await redis.setex(viewKey, 3600, "1");
    }
  }

  if (!video) throw new ApiError(404, "Video not found");

  // Update WatchHistory (new separate collection — Phase 0 fix)
  if (req.user?._id) {
    try {
      await WatchHistory.findOneAndUpdate(
        { user: req.user._id, video: videoId },
        { watchedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch {
      // ignore — watching shouldn't fail due to history errors
    }
  }

  return res.status(200).json(new ApiResponse(200, video, "View incremented"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (String(video.owner) !== String(req.user._id) && req.user.role !== "admin")
    throw new ApiError(403, "Not authorized to update this video");

  const { title, description } = req.body;
  const updateObj = {};

  if (title?.trim()) updateObj.title = title.trim();
  if (description?.trim()) updateObj.description = description.trim();

  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
  if (thumbnailLocalPath) {
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath, "thumbnails");
    if (!uploadedThumbnail?.url) throw new ApiError(500, "Error uploading thumbnail");
    updateObj.thumbnail = uploadedThumbnail.url;
  }

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  if (videoLocalPath) {
    const uploadedVideo = await uploadOnCloudinary(videoLocalPath, "videos");
    if (!uploadedVideo?.url) throw new ApiError(500, "Error uploading video");
    updateObj.videoFile = uploadedVideo.url;
    updateObj.duration = uploadedVideo.duration || video.duration;
  }

  const updated = await Video.findByIdAndUpdate(videoId, { $set: updateObj }, { new: true })
    .populate({ path: "owner", select: "fullName username avatar" })
    .select("-__v");

  // Phase 4 fix: manually sync to Meilisearch (findByIdAndUpdate bypasses save hooks)
  if (updated && updated.isPublished) {
    syncVideoToSearch(updated).catch(() => {});
  }

  return res.status(200).json(new ApiResponse(200, updated, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (String(video.owner) !== String(req.user._id) && req.user.role !== "admin")
    throw new ApiError(403, "Not authorized to delete this video");

  // Phase 4 fix: use findOneAndDelete so Mongoose post('findOneAndDelete') hook fires
  // and removes the video from Meilisearch
  await Video.findOneAndDelete({ _id: videoId });

  return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (String(video.owner) !== String(req.user._id) && req.user.role !== "admin")
    throw new ApiError(403, "Not authorized to change publish status of this video");

  video.isPublished = !video.isPublished;
  await video.save();

  // Phase 4 fix: remove from search when unpublishing, sync when publishing
  if (!video.isPublished) {
    removeVideoFromSearch(video._id).catch(() => {});
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, `Video is now ${video.isPublished ? "published" : "unpublished"}`)
    );
});

const retranscodeVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  
  if (String(video.owner) !== String(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "Not authorized to re-transcode this video");
  }

  // Reject if already processing
  if (video.status === "processing") {
    throw new ApiError(409, "Video is already being transcoded");
  }

  // Enforce 10-minute cooldown between retranscode attempts
  if (video.lastTranscodeAt) {
    const elapsed = Date.now() - new Date(video.lastTranscodeAt).getTime();
    const cooldownMs = 10 * 60 * 1000; // 10 minutes
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 60000);
      throw new ApiError(429, `Please wait ${remaining} minute${remaining > 1 ? "s" : ""} before retranscoding again`);
    }
  }

  // Reset progress and update status
  video.status = "processing";
  video.progress = 0;
  video.lastTranscodeAt = new Date();
  await video.save();

  try {
    const enqueuePromise = getVideoQueue().add(
      "transcode",
      {
        videoId: String(video._id),
        rawUrl: video.videoFile,
        title: video.title,
        duration: Math.round(video.duration || 0)
      },
      { jobId: `transcode-${video._id}` }
    );

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
    );

    await Promise.race([enqueuePromise, timeoutPromise]);
    logger.info({ videoId: video._id }, "Video re-transcoding job enqueued");
  } catch (queueError) {
    logger.warn({ err: queueError, videoId: video._id }, "Queue unavailable — video set to ready");
    video.status = "ready";
    video.progress = 0;
    await video.save();
    throw new ApiError(503, "Background processing queue is currently offline. Please ensure Redis is running to use transcoding.");
  }

  return res.status(200).json(new ApiResponse(200, video, "Video enqueued for re-transcoding"));
});

/**
 * GET /api/v1/videos/status/:videoId
 * Returns the current processing status of a video.
 * Used by the frontend to poll until transcoding is complete.
 */
const getVideoStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId).select("status aiStatus hlsUrl videoFile progress").lean();
  if (!video) throw new ApiError(404, "Video not found");

  return res.status(200).json(
    new ApiResponse(200, {
      status: video.status,
      aiStatus: video.aiStatus || "pending",
      hlsUrl: video.hlsUrl || "",
      videoFile: video.videoFile,
      progress: video.progress || 0,
    }, "Video status fetched")
  );
});

const getRecommendations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.max(parseInt(req.query.limit) || 6, 1);

  if (!isValidObjectId(id)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(id).select("tags");
  if (!video) throw new ApiError(404, "Video not found");

  const tags = video.tags || [];

  if (tags.length === 0) {
    const randomVideos = await Video.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(id) }, isPublished: true } },
      { $sample: { size: limit } },
      {
         $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner"
         }
      },
      { $unwind: "$owner" },
      { $project: { "owner.password": 0, "owner.refreshToken": 0, "owner.email": 0 } }
    ]);
    return res.status(200).json(new ApiResponse(200, randomVideos, "Recommendations fetched"));
  }

  const recommended = await Video.aggregate([
    { $match: { _id: { $ne: new mongoose.Types.ObjectId(id) }, isPublished: true, tags: { $in: tags } } },
    {
      $addFields: {
        score: { $size: { $setIntersection: ["$tags", tags] } }
      }
    },
    { $sort: { score: -1, views: -1 } },
    { $limit: limit },
    {
       $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner"
       }
    },
    { $unwind: "$owner" },
    { $project: { "owner.password": 0, "owner.refreshToken": 0, "owner.email": 0 } }
  ]);

  // Fallback to random if not enough tag matches
  if (recommended.length < limit) {
    const randomVideos = await Video.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(id) }, isPublished: true, _id: { $nin: recommended.map(r => r._id) } } },
      { $sample: { size: limit - recommended.length } },
      {
         $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner"
         }
      },
      { $unwind: "$owner" },
      { $project: { "owner.password": 0, "owner.refreshToken": 0, "owner.email": 0 } }
    ]);
    recommended.push(...randomVideos);
  }

  return res.status(200).json(new ApiResponse(200, recommended, "Recommendations fetched"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  getVideoStatus,
  incrementVideoView,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  retranscodeVideo,
  getRecommendations,
};

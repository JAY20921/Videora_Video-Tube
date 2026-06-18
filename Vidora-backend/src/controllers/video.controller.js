import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { WatchHistory } from "../models/watchHistory.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getVideoQueue } from "../queues/videoQueue.js";
import { logger } from "../utils/logger.js";

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

  // Phase 3: Mark video as "processing" — the worker will update to "ready" after HLS transcoding
  const newVideo = await Video.create({
    title: title.trim(),
    description: description.trim(),
    duration,
    videoFile: uploadedVideo.url,
    thumbnail: uploadedThumbnail?.url || "",
    owner: req.user._id,
    status: "processing",
  });

  // Enqueue the video for HLS transcoding via BullMQ
  try {
    await getVideoQueue().add(
      "transcode",
      {
        videoId: String(newVideo._id),
        rawUrl: uploadedVideo.url,
        title: title.trim(),
      },
      { jobId: `transcode-${newVideo._id}` }
    );
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

  return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
});

const incrementVideoView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }, { new: true })
    .populate({ path: "owner", select: "fullName username avatar" })
    .lean();

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
  if (String(video.owner) !== String(req.user._id))
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

  return res.status(200).json(new ApiResponse(200, updated, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (String(video.owner) !== String(req.user._id))
    throw new ApiError(403, "Not authorized to delete this video");

  await Video.deleteOne({ _id: videoId });

  return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (String(video.owner) !== String(req.user._id))
    throw new ApiError(403, "Not authorized to change publish status of this video");

  video.isPublished = !video.isPublished;
  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, `Video is now ${video.isPublished ? "published" : "unpublished"}`)
    );
});

/**
 * GET /api/v1/videos/status/:videoId
 * Returns the current processing status of a video.
 * Used by the frontend to poll until transcoding is complete.
 */
const getVideoStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findById(videoId).select("status hlsUrl videoFile").lean();
  if (!video) throw new ApiError(404, "Video not found");

  return res.status(200).json(
    new ApiResponse(200, {
      status: video.status,
      hlsUrl: video.hlsUrl || "",
      videoFile: video.videoFile,
    }, "Video status fetched")
  );
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
};

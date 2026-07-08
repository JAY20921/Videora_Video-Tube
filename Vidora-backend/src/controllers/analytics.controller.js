import mongoose from "mongoose";
import { getAnalyticsQueue } from "../queues/analyticsQueue.js";
import { ViewEvent } from "../models/viewEvent.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// @desc    Ingest telemetry event
// @route   POST /api/v1/analytics/event
// @access  Public/Private
export const ingestEvent = asyncHandler(async (req, res) => {
  const { videoId, eventType, timestamp } = req.body;
  const userId = req.user?._id;

  if (!videoId || !eventType || timestamp === undefined) {
    throw new ApiError(400, "Missing required telemetry fields");
  }

  // Push to BullMQ for asynchronous processing
  const analyticsQueue = getAnalyticsQueue();
  await analyticsQueue.add("process-event", {
    videoId,
    userId: userId || null,
    eventType,
    timestamp,
    createdAt: new Date(),
  });

  return res.status(202).json(new ApiResponse(202, {}, "Event accepted"));
});

// @desc    Get analytics for a video
// @route   GET /api/v1/analytics/video/:videoId
// @access  Private
export const getVideoAnalytics = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // Aggregate heartbeats into daily buckets for Views over Time
  const retentionData = await ViewEvent.aggregate([
    { 
      $match: { 
        videoId: new mongoose.Types.ObjectId(videoId), 
        eventType: "heartbeat" 
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } },
    {
      $project: {
         date: "$_id",
         views: "$count",
         _id: 0
      }
    }
  ]);

  return res.status(200).json(new ApiResponse(200, { retentionData }, "Analytics retrieved"));
});

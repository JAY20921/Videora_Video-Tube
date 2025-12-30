import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user?._id; // assuming auth middleware adds req.user

    if (!channelId) {
        throw new ApiError(401, "Unauthorized: Channel ID not found");
    }

    // Total videos uploaded by the channel
    const totalVideos = await Video.countDocuments({ owner: channelId });

    // Total views across all videos
    const totalViewsAgg = await Video.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ]);
    const totalViews = totalViewsAgg.length > 0 ? totalViewsAgg[0].totalViews : 0;

    // Total subscribers (users who subscribed to this channel)
    const totalSubscribers = await Subscription.countDocuments({ channel: channelId });

    // Total likes on all videos owned by this channel
    const totalLikesAgg = await Like.aggregate([
        { 
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoDetails"
            }
        },
        { $unwind: "$videoDetails" },
        { $match: { "videoDetails.owner": new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalLikes: { $sum: 1 } } }
    ]);
    const totalLikes = totalLikesAgg.length > 0 ? totalLikesAgg[0].totalLikes : 0;

    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                totalVideos,
                totalViews,
                totalSubscribers,
                totalLikes
            }, "Channel stats fetched successfully")
        );
});

// -------------------------
// Get All Channel Videos
// -------------------------
const getChannelVideos = asyncHandler(async (req, res) => {
    const channelId = req.user?._id;

    if (!channelId) {
        throw new ApiError(401, "Unauthorized: Channel ID not found");
    }

    // Fetch all videos uploaded by this channel
    const videos = await Video.find({ owner: channelId })
        .sort({ createdAt: -1 })
        .select("title description thumbnail views duration isPublished createdAt");

    return res
        .status(200)
        .json(
            new ApiResponse(200, videos, "Channel videos fetched successfully")
        );
});

export {
    getChannelStats,
    getChannelVideos
}
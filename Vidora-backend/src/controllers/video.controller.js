import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query

    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const perPage = Math.max(parseInt(limit, 10) || 10, 1)

    const filter = {}

    // text search on title / description if query provided
    if (query && query.trim()) {
        const q = query.trim()
        filter.$or = [
            { title: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } }
        ]
    }

    // filter by owner / userId if valid
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId")
        }
        filter.owner = new mongoose.Types.ObjectId(userId)
    }

    // sorting
    const sortDirection = sortType === "asc" ? 1 : -1
    const sortObj = {}
    sortObj[sortBy] = sortDirection

    const total = await Video.countDocuments(filter)
    const videos = await Video.find(filter)
        .populate({ path: "owner", select: "fullName username avatar" })
        .sort(sortObj)
        .skip((pageNum - 1) * perPage)
        .limit(perPage)
        .lean()

    const totalPages = Math.ceil(total / perPage) || 1

    return res.status(200).json(
        new ApiResponse(200, {
            videos,
            meta: {
                total,
                page: pageNum,
                limit: perPage,
                totalPages,
            }
        }, "Videos fetched successfully")
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, duration } = req.body

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "title and description are required")
    }

    // Video file (required)
   const videoLocalPath = req.files?.videoFile?.[0]?.path;
if (!videoLocalPath) {
  throw new ApiError(400, "Video file is required");
}

const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    // Upload video
    const uploadedVideo = await uploadOnCloudinary(videoLocalPath, "videos")
    if (!uploadedVideo || !uploadedVideo.url) {
        throw new ApiError(500, "Error uploading video")
    }

    // Upload thumbnail if provided
    let uploadedThumbnail = null
    if (thumbnailLocalPath) {
        uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath, "thumbnails")
        if (!uploadedThumbnail || !uploadedThumbnail.url) {
            throw new ApiError(500, "Error uploading thumbnail")
        }
    }

    // duration parsing
    let parsedDuration = Number(duration)
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
        // if duration not provided or invalid, default 0
        parsedDuration = 0
    }

    const newVideo = await Video.create({
        title: title.trim(),
        description: description.trim(),
        duration: parsedDuration,
        videoFile: uploadedVideo.url,
        thumbnail: uploadedThumbnail?.url || "",
        owner: req.user._id,
    })

    const created = await Video.findById(newVideo._id).populate({ path: "owner", select: "fullName username avatar" }).select("-__v")

    return res.status(201).json(new ApiResponse(201, created, "Video published successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.findById(videoId)
        .populate({ path: "owner", select: "fullName username avatar" })
        .lean()

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"))
})

const incrementVideoView = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }, { new: true })
        .populate({ path: "owner", select: "fullName username avatar" })
        .lean()

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Optionally add to user's watch history if authenticated
    try {
        if (req.user?._id) {
            await User.findByIdAndUpdate(req.user._id, { $push: { watchHistory: video._id } })
        }
    } catch (e) {
        // ignore errors when adding watchHistory
    }

    return res.status(200).json(new ApiResponse(200, video, "View incremented"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Only owner can update
    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "Not authorized to update this video")
    }

    const { title, description, duration } = req.body
    const updateObj = {}

    if (title && title.trim()) updateObj.title = title.trim()
    if (description && description.trim()) updateObj.description = description.trim()
    if (duration !== undefined) {
        const parsedDuration = Number(duration)
        if (!isNaN(parsedDuration) && isFinite(parsedDuration)) {
            updateObj.duration = parsedDuration
        }
    }

    // If thumbnail file is provided, upload and update
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path
    if (thumbnailLocalPath) {
        const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath, "thumbnails")
        if (!uploadedThumbnail || !uploadedThumbnail.url) {
            throw new ApiError(500, "Error uploading thumbnail")
        }
        updateObj.thumbnail = uploadedThumbnail.url
    }

    // If video file is provided, upload and update videoFile
    const videoLocalPath = req.files?.videoFile?.[0]?.path
    if (videoLocalPath) {
        const uploadedVideo = await uploadOnCloudinary(videoLocalPath, "videos")
        if (!uploadedVideo || !uploadedVideo.url) {
            throw new ApiError(500, "Error uploading video")
        }
        updateObj.videoFile = uploadedVideo.url
    }

    const updated = await Video.findByIdAndUpdate(videoId, { $set: updateObj }, { new: true })
        .populate({ path: "owner", select: "fullName username avatar" })
        .select("-__v")

    return res.status(200).json(new ApiResponse(200, updated, "Video updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Only owner can delete
    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "Not authorized to delete this video")
    }

    await Video.deleteOne({ _id: videoId })

    return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Only owner can toggle publish status
    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "Not authorized to change publish status of this video")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res.status(200).json(new ApiResponse(200, video, `Video is now ${video.isPublished ? "published" : "unpublished"}`))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    incrementVideoView,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}

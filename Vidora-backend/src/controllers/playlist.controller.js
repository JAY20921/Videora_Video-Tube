import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body
    const userId = req.user?._id

    //TODO: create playlist
    if (!name || !description) {
        throw new ApiError(400, "Name and description are required")
    }

    const playlist = await Playlist.create({
        name,
        desciption: description,
        owner: userId,
        videos: []
    })

    return res
        .status(201)
        .json(new ApiResponse(201, playlist, "Playlist created successfully"))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params

    //TODO: get user playlists
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID")
    }

    const playlists = await Playlist.find({ owner: userId }).populate("videos", "title thumbnail views")

    return res
        .status(200)
        .json(new ApiResponse(200, playlists, "User playlists fetched successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    //TODO: get playlist by id
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID")
    }

    const playlist = await Playlist.findById(playlistId).populate("videos", "title thumbnail views owner")

    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist fetched successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    const userId = req.user?._id

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only modify your own playlists")
    }

    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already in playlist")
    }

    playlist.videos.push(videoId)
    await playlist.save()

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Video added to playlist successfully"))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    const userId = req.user?._id

    // TODO: remove video from playlist
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only modify your own playlists")
    }

    playlist.videos = playlist.videos.filter(
        (v) => v.toString() !== videoId.toString()
    )

    await playlist.save()

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Video removed from playlist successfully"))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const userId = req.user?._id

    // TODO: delete playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only delete your own playlists")
    }

    await playlist.deleteOne()

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Playlist deleted successfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body
    const userId = req.user?._id

    //TODO: update playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    if (playlist.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only update your own playlists")
    }

    if (name) playlist.name = name
    if (description) playlist.desciption = description

    await playlist.save()

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist updated successfully"))
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}

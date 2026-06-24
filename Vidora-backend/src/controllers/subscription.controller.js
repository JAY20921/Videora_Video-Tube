import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID")
    }

    if (req.user?._id.toString() === channelId.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel")
    }

    const existingSubscription = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId
    })

    if (existingSubscription) {
        await Subscription.findByIdAndDelete(existingSubscription._id)
        return res
            .status(200)
            .json(new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully"))
    }

    const newSubscription = await Subscription.create({
        subscriber: req.user._id,
        channel: channelId
    })

    return res
        .status(200)
        .json(new ApiResponse(200, { subscribed: true, subscription: newSubscription }, "Subscribed successfully"))
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    // The route uses "/u/:subscriberId"
    const { subscriberId } = req.params
    const subscribers = await Subscription.find({ channel: subscriberId }).populate("subscriber", "username fullName avatar")
    return res
        .status(200)
        .json(new ApiResponse(200, subscribers, "Subscribers fetched successfully"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    // The route uses "/c/:channelId"
    const { channelId } = req.params
    const channels = await Subscription.find({ subscriber: channelId }).populate("channel", "username fullName avatar")
    return res
        .status(200)
        .json(new ApiResponse(200, channels, "Subscribed channels fetched successfully"))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}

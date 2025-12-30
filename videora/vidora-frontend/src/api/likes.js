import api from "./client";

export const likeVideo = (videoId) =>
  api.post(`/likes/toggle/v/${videoId}`);

export const likeComment = (commentId) =>
  api.post(`/likes/toggle/c/${commentId}`);

export const likeTweet = (tweetId) =>
  api.post(`/likes/toggle/t/${tweetId}`);

export const getLikedVideos = () =>
  api.get("/likes/videos");

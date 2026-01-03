import api from "./client";

export const createTweet = (data) =>
  api.post("/tweets", data);

export const getUserTweets = (userId) =>
  api.get(`/tweets/user/${userId}`);

export const updateTweet = (tweetId, data) =>
  api.patch(`/tweets/${tweetId}`, data);

export const deleteTweet = (tweetId) =>
  api.delete(`/tweets/${tweetId}`);

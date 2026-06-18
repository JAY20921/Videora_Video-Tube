// src/api/users.js
import api from "./client";

const unwrap = (res) => res?.data?.data ?? res?.data ?? res;

// Channel profile (public aggregate with subscriber info)
export const getChannelProfile = async (username) => {
  if (!username) return null;
  const res = await api.get(`/users/c/${encodeURIComponent(username)}`);
  return unwrap(res);
};

// Subscriptions
export const toggleSubscription = async (channelId) => {
  const res = await api.post(`/subscriptions/c/${channelId}`);
  return unwrap(res);
};

export const getSubscribedChannels = async (subscriberId) => {
  const res = await api.get(`/subscriptions/c/${subscriberId}`);
  return unwrap(res);
};

export const getChannelSubscribers = async (channelId) => {
  const res = await api.get(`/subscriptions/u/${channelId}`);
  return unwrap(res);
};

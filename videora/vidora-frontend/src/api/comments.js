import api from "./client";

export const getComments = (videoId) =>
  api.get(`/comments/${videoId}`);

export const addComment = (videoId, data) =>
  api.post(`/comments/${videoId}`, data);

export const updateComment = (commentId, data) =>
  api.patch(`/comments/c/${commentId}`, data);

export const deleteComment = (commentId) =>
  api.delete(`/comments/c/${commentId}`);

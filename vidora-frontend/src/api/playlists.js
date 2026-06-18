// src/api/playlists.js
import api from "./client";

const unwrap = (res) => res?.data?.data ?? res?.data ?? res;

export const createPlaylist = async (data) => {
  const res = await api.post("/playlist", data);
  return unwrap(res);
};

export const getPlaylistById = async (playlistId) => {
  const res = await api.get(`/playlist/${playlistId}`);
  return unwrap(res);
};

export const getUserPlaylists = async (userId) => {
  const res = await api.get(`/playlist/user/${userId}`);
  return unwrap(res);
};

export const updatePlaylist = async (playlistId, data) => {
  const res = await api.patch(`/playlist/${playlistId}`, data);
  return unwrap(res);
};

export const deletePlaylist = async (playlistId) => {
  const res = await api.delete(`/playlist/${playlistId}`);
  return unwrap(res);
};

export const addVideoToPlaylist = async (videoId, playlistId) => {
  const res = await api.patch(`/playlist/add/${videoId}/${playlistId}`);
  return unwrap(res);
};

export const removeVideoFromPlaylist = async (videoId, playlistId) => {
  const res = await api.patch(`/playlist/remove/${videoId}/${playlistId}`);
  return unwrap(res);
};

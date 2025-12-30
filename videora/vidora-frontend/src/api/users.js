import axios from "./axiosInstance";

export const getChannelProfile = async (username) => {
  if (!username) return null;
  const res = await axios.get(`/users/c/${encodeURIComponent(username)}`);
  return res.data;
};

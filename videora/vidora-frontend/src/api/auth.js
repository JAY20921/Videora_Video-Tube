import api from "./client";

const unwrap = (res) => res?.data?.data ?? res?.data ?? res;

// Auth
export const register = (formData) =>
  api.post("/users/register", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(unwrap);

export const login = (data) =>
  api.post("/users/login", data).then(unwrap);

export const logout = () =>
  api.post("/users/logout").then(unwrap);

export const refreshToken = () =>
  api.post("/users/refresh-token").then(unwrap);

export const getCurrentUser = () =>
  api.get("/users/current-user").then(unwrap);

// Account
export const changePassword = (data) =>
  api.post("/users/change-password", data).then(unwrap);

export const updateAccount = (data) =>
  api.patch("/users/update-account", data).then(unwrap);

// Files
export const uploadAvatar = (formData) =>
  api.patch("/users/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(unwrap);

export const uploadCover = (formData) =>
  api.patch("/users/cover-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(unwrap);

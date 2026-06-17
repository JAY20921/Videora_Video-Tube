import multer from "multer";
import path from "path";
import { ApiError } from "../utils/ApiError.js";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const fileFilter = (req, file, cb) => {
  const fieldName = file.fieldname; // "videoFile", "thumbnail", "avatar", "coverImage"
  const isVideoField = fieldName === "videoFile";
  const allowed = isVideoField ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;

  if (!allowed.includes(file.mimetype)) {
    const typeLabel = isVideoField ? "video" : "image";
    return cb(
      new ApiError(415, `Invalid ${typeLabel} type. Allowed: ${allowed.join(", ")}`),
      false
    );
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

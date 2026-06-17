import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * @param {string} localFilePath  - Absolute path to the temp file on disk
 * @param {string} folder         - Cloudinary folder (e.g. "avatars", "videos", "thumbnails")
 * @returns {Promise<object|null>} - Cloudinary upload response, or null on failure
 */
export const uploadOnCloudinary = async (localFilePath, folder = "misc") => {
  try {
    if (!localFilePath) throw new Error("File path is required");

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: `vidora/${folder}`, // ← fixed: folder is now used
    });

    // Clean up the local temp file after successful upload
    if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    // Always clean up temp file, even on failure
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    logger.error({ err: error }, "Cloudinary upload failed");
    return null;
  }
};

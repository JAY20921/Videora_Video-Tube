import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
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
 * @param {string} resourceType   - Resource type ("auto", "image", "video", "raw")
 * @returns {Promise<object|null>} - Cloudinary upload response, or null on failure
 */
export const uploadOnCloudinary = async (localFilePath, folder = "misc", resourceType = "auto") => {
  try {
    if (!localFilePath) throw new Error("File path is required");

    // upload_large automatically handles chunking and prevents timeouts for large videos
    const response = await new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: resourceType,
        folder: `vidora/${folder}`,
        chunk_size: 6000000, // 6MB chunks
      };

      if (resourceType === "raw") {
        uploadOptions.public_id = path.basename(localFilePath);
      }

      cloudinary.uploader.upload_large(
        localFilePath,
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          
          // Force secure URLs to avoid Mixed Content errors on the frontend
          if (result && result.secure_url) {
            result.url = result.secure_url;
          }
          
          resolve(result);
        }
      );
    });

    if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    logger.error({ err: error.message || error }, "Cloudinary upload failed");
    return null;
  }
};

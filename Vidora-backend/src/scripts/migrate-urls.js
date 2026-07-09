import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { DB_NAME } from "../constants.js";

dotenv.config();

const ensureHttps = (url) => {
  if (typeof url === 'string' && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

const runMigration = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected to MongoDB database: ${DB_NAME}`);

    // Fix Users
    const users = await User.find({
      $or: [
        { avatar: { $regex: /^http:\/\//i } },
        { coverImage: { $regex: /^http:\/\//i } }
      ]
    });

    let userUpdates = 0;
    for (const user of users) {
      if (user.avatar) user.avatar = ensureHttps(user.avatar);
      if (user.coverImage) user.coverImage = ensureHttps(user.coverImage);
      await user.save({ validateBeforeSave: false });
      userUpdates++;
    }
    console.log(`Updated ${userUpdates} users`);

    // Fix Videos
    const videos = await Video.find({
      $or: [
        { videoFile: { $regex: /^http:\/\//i } },
        { thumbnail: { $regex: /^http:\/\//i } },
        { hlsUrl: { $regex: /^http:\/\//i } },
        { spritesheetUrl: { $regex: /^http:\/\//i } }
      ]
    });

    let videoUpdates = 0;
    for (const video of videos) {
      if (video.videoFile) video.videoFile = ensureHttps(video.videoFile);
      if (video.thumbnail) video.thumbnail = ensureHttps(video.thumbnail);
      if (video.hlsUrl) video.hlsUrl = ensureHttps(video.hlsUrl);
      if (video.spritesheetUrl) video.spritesheetUrl = ensureHttps(video.spritesheetUrl);
      await video.save({ validateBeforeSave: false });
      videoUpdates++;
    }
    console.log(`Updated ${videoUpdates} videos`);

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

runMigration();

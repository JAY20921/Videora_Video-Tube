/**
 * Retranscode Script
 *
 * Finds all videos that don't have HLS streams yet and enqueues
 * them into the BullMQ video-processing queue.
 *
 * Usage: node src/scripts/retranscode.js
 * Requires: Redis connected (cloud Redis configured in .env)
 * Then run the worker: npm run worker:dev
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { getVideoQueue } from "../queues/videoQueue.js";

const DB_NAME = "videotube";

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(`${mongoUri}/${DB_NAME}`);
  console.log("Connected to MongoDB");

  // Find all videos without HLS
  const videos = await Video.find({
    $or: [
      { hlsUrl: { $exists: false } },
      { hlsUrl: "" },
      { hlsUrl: null },
    ],
    videoFile: { $exists: true, $ne: "" },
  }).lean();

  console.log(`Found ${videos.length} videos without HLS streams\n`);

  if (videos.length === 0) {
    console.log("Nothing to do!");
    process.exit(0);
  }

  const queue = getVideoQueue();

  for (const video of videos) {
    const rawUrl = video.videoFile;
    if (!rawUrl) {
      console.log(`  SKIP ${video._id} (${video.title}) — no videoFile URL`);
      continue;
    }

    // Mark as processing
    await Video.findByIdAndUpdate(video._id, { status: "processing" });

    // Enqueue
    await queue.add("transcode", {
      videoId: video._id.toString(),
      rawUrl,
      title: video.title || "Untitled",
    });

    console.log(`  QUEUED ${video._id} — ${video.title}`);
  }

  console.log(`\nDone! ${videos.length} videos enqueued.`);
  console.log("Now start the worker: npm run worker:dev");

  // Give BullMQ time to flush
  await new Promise(r => setTimeout(r, 2000));
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

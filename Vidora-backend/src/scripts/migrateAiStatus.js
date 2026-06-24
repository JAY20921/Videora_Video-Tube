/**
 * One-time migration: Set aiStatus to "skipped" for all existing videos
 * that were uploaded before Phase 5 was implemented.
 *
 * Run: node -r dotenv/config src/scripts/migrateAiStatus.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Video } from "../models/video.model.js";

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(`${mongoUri}/videotube`);
  console.log("Connected to MongoDB");

  // Update all videos that don't have aiStatus set, or have it as "pending"
  // but don't have a transcript (meaning they were never processed by the AI worker)
  const result = await Video.updateMany(
    {
      $or: [
        { aiStatus: { $exists: false } },
        { aiStatus: "pending", transcript: { $exists: false } },
        { aiStatus: "pending", transcript: null },
      ],
    },
    { $set: { aiStatus: "skipped" } }
  );

  console.log(`Updated ${result.modifiedCount} videos → aiStatus: "skipped"`);

  await mongoose.disconnect();
  console.log("Done!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

/**
 * Phase 4: Bulk sync script.
 *
 * Run: node -r dotenv/config src/scripts/syncSearch.js
 *
 * Indexes all published videos from MongoDB into Meilisearch.
 * Use this for initial migration or to rebuild the search index.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { config } from "../config/index.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { bulkSyncVideos } from "../services/searchSync.js";
import { DB_NAME } from "../constants.js";

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(`${config.mongo.uri}/${DB_NAME}`);
  console.log("✅ MongoDB connected");

  console.log("📦 Syncing all videos to Meilisearch...");
  const result = await bulkSyncVideos(Video);
  console.log(`✅ Sync complete — ${result.synced} videos indexed (task: ${result.taskUid || "N/A"})`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err.message);
  process.exit(1);
});

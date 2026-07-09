import "dotenv/config";
import { getAiQueue } from "./src/queues/aiQueue.js";
import mongoose from "mongoose";

async function checkFailed() {
  const q = getAiQueue();
  const failed = await q.getFailed(0, 10);
  console.log("Failed jobs:");
  for (const job of failed) {
    console.log(`Job ${job.id}:`, job.failedReason);
  }
  process.exit(0);
}
checkFailed();

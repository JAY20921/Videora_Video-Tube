import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.js";
import { logger } from "../utils/logger.js";

/**
 * Video processing queue — lazy-initialized.
 *
 * The queue is only created when getVideoQueue() is first called,
 * preventing Redis connection spam when Redis isn't running.
 *
 * Job data shape:
 * {
 *   videoId: string,       // MongoDB Video._id
 *   rawUrl: string,        // Cloudinary URL of the raw uploaded file
 *   title: string,         // For logging context
 * }
 */
let _queue = null;

export function getVideoQueue() {
  if (!_queue) {
    _queue = new Queue("video-processing", {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // 5s → 10s → 20s
        },
        removeOnComplete: {
          count: 100,   // keep the last 100 completed jobs for debugging
        },
        removeOnFail: {
          count: 200,   // keep the last 200 failed jobs for inspection
        },
      },
    });

    // Suppress unhandled error events from crashing the process
    _queue.on("error", (err) => {
      logger.warn({ err: err.message }, "Video queue connection issue (Redis may not be running)");
    });
  }
  return _queue;
}

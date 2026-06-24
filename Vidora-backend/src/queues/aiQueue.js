import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.js";
import { logger } from "../utils/logger.js";

/**
 * Phase 5: AI processing queue — lazy-initialized.
 *
 * Separate from the video-processing queue so AI work
 * doesn't block video transcoding.
 *
 * Job data shape:
 * {
 *   videoId: string,       // MongoDB Video._id
 *   rawUrl: string,        // Cloudinary URL of the raw uploaded video
 *   title: string,         // For logging context
 *   duration: number,      // Video duration in seconds
 * }
 */
let _queue = null;

export function getAiQueue() {
  if (!_queue) {
    _queue = new Queue("ai-processing", {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10000, // 10s → 20s → 40s (AI APIs can be slow)
        },
        removeOnComplete: {
          count: 50,
        },
        removeOnFail: {
          count: 100,
        },
      },
    });

    _queue.on("error", (err) => {
      logger.warn({ err: err.message }, "AI queue connection issue (Redis may not be running)");
    });
  }
  return _queue;
}

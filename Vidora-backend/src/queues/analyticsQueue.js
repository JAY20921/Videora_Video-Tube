import { Queue } from "bullmq";
import { redisConfig } from "../config/redis.js";
import { logger } from "../utils/logger.js";

let _queue = null;

export function getAnalyticsQueue() {
  if (!_queue) {
    _queue = new Queue("analytics-jobs", {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });

    _queue.on("error", (err) => {
      logger.warn({ err: err.message }, "Analytics queue connection issue");
    });
  }
  return _queue;
}

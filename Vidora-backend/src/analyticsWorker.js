import { Worker } from "bullmq";
import { redisConfig } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { connectDB } from "./db/index.js";
import { ViewEvent } from "./models/viewEvent.model.js";

const WORKER_NAME = "analytics-worker";

// Connect to DB once when worker starts
connectDB()
  .then(() => logger.info(`${WORKER_NAME} connected to MongoDB`))
  .catch((err) => {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  });

logger.info(`Starting ${WORKER_NAME}...`);

let eventBuffer = [];
let flushTimeout = null;

const flushBuffer = async () => {
  if (eventBuffer.length === 0) return;
  const eventsToInsert = [...eventBuffer];
  eventBuffer = [];
  
  try {
    await ViewEvent.insertMany(eventsToInsert, { ordered: false });
    logger.info(`Inserted ${eventsToInsert.length} analytics events`);
  } catch (error) {
    logger.error({ err: error.message }, "Failed to bulk insert analytics events");
  }
};

const worker = new Worker(
  "analytics-jobs",
  async (job) => {
    const data = job.data;
    
    eventBuffer.push(data);
    
    if (eventBuffer.length >= 100) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
      await flushBuffer();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(async () => {
        flushTimeout = null;
        await flushBuffer();
      }, 5000); // Flush at least every 5 seconds
    }
    
    return true;
  },
  {
    connection: redisConfig,
    concurrency: 50,
  }
);

worker.on("completed", (job) => {});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job.id, err: err.message }, "Analytics job failed");
});

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, closing worker...`);
  await flushBuffer();
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

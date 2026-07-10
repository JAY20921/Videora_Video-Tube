import "dotenv/config";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { logger } from "./utils/logger.js";
import { config } from "./config/index.js";
import { initSocket } from "./socket.js";
import { startWorkers, stopWorkers } from "./workers.js";

let server;

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop BullMQ workers first (flush analytics buffer, close connections)
  await stopWorkers().catch((err) =>
    logger.error({ err }, "Error stopping workers")
  );

  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    // Force shutdown almost immediately if WebSockets/Keep-Alives are hanging
    setTimeout(() => {
      logger.info("Forced shutdown");
      process.exit(0);
    }, 1500); // 1.5 seconds is plenty for a local backend to flush
  } else {
    process.exit(0);
  }
};

connectDB()
  .then(async () => {
    server = app.listen(config.port, "0.0.0.0", () => {
      logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });
    
    // Initialize Socket.IO
    initSocket(server);

    // Start all BullMQ workers in-process (video, AI, analytics)
    // This eliminates the need for separate worker deployments
    await startWorkers();

    server.on("error", (error) => {
      logger.error({ err: error }, "Server error");
      process.exit(1);
    });
  })
  .catch((error) => {
    logger.error({ err: error }, "Failed to connect to the database");
    process.exit(1);
  });

// ─── Graceful shutdown signals ────────────────────────────────────────────────
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Unhandled rejection safety net ──────────────────────────────────────────
// CRITICAL: Do NOT kill the process on unhandled rejections.
// A stray promise rejection (Redis timeout, API failure, etc.) should not
// bring down the entire server. Log it and move on.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason: reason?.message || reason }, "Unhandled Promise Rejection (non-fatal)");
  // NOT calling process.exit() — the server stays alive
});

// ─── Uncaught exception safety net ────────────────────────────────────────────
// Synchronous throws that escape all try-catch blocks.
// These are more dangerous than rejections, but we still try to survive.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught Exception (non-fatal — server continues)");
  // Only kill the process if it's truly unrecoverable (e.g., out of memory)
  // For everything else, log and continue
});

// ─── Memory monitoring ───────────────────────────────────────────────────────
// Log memory usage every 60 seconds to help diagnose OOM issues
setInterval(() => {
  const usage = process.memoryUsage();
  const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  
  if (rssMB > 400) {
    logger.warn({ heapMB, rssMB }, "⚠️ HIGH MEMORY — approaching Render free-tier limit (512MB)");
  } else if (rssMB > 300) {
    logger.info({ heapMB, rssMB }, "Memory usage elevated");
  }
}, 60000);
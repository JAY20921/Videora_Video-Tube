import "dotenv/config";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { logger } from "./utils/logger.js";
import { config } from "./config/index.js";
import { initSocket } from "./socket.js";

let server;

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    // Force shutdown after 10 seconds if connections don't close
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  } else {
    process.exit(0);
  }
};

connectDB()
  .then(() => {
    server = app.listen(config.port, "0.0.0.0", () => {
      logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });
    
    // Initialize Socket.IO
    initSocket(server);

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
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Promise Rejection — shutting down");
  gracefulShutdown("unhandledRejection");
});
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

/**
 * Global error-handling middleware.
 * Must be mounted LAST in app.js (after all routes).
 * Express identifies it as an error handler because it takes 4 args.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error(
    { err, method: req.method, url: req.url, statusCode },
    message
  );

  return res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    ...(config.nodeEnv === "development" && { stack: err.stack }),
  });
};

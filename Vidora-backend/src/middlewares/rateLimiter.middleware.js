import rateLimit from "express-rate-limit";

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * skip() — bypasses the rate limiter entirely in development.
 * This prevents the frustrating "429 Too Many Requests" when you
 * reload the app repeatedly during local development.
 */
const skipInDev = () => IS_DEV;

const rateLimitHandler = (req, res) => {
  const retryAfter = Math.ceil(req.rateLimit?.resetTime
    ? (req.rateLimit.resetTime - Date.now()) / 1000 / 60
    : 15);

  res.status(429).json({
    success: false,
    message: `Too many requests. Please try again in ${retryAfter} minute(s).`,
  });
};

/**
 * Auth routes: login + register.
 * Production: 20 per 15 minutes (lenient enough for normal use, strict enough to block brute force).
 * Development: unlimited (skip = true).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skip: skipInDev,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Upload route — 10 uploads per hour per IP.
 * Development: unlimited.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  skip: skipInDev,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * General API — 300 requests per 15 minutes per IP.
 * High enough to not interfere with normal usage, low enough to throttle scrapers.
 * Development: unlimited.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  skip: skipInDev,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});


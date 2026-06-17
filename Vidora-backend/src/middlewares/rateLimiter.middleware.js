import rateLimit from "express-rate-limit";

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

/** Auth routes: login + register — 10 requests per 15 minutes */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Upload route — 5 uploads per hour */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** General API — 100 requests per 15 minutes */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

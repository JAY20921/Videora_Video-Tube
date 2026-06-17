import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { config } from "./config/index.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";

const app = express();

// ─── Security headers (must be first) ────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.cors.origins.length === 0) return callback(null, true);
      if (config.cors.origins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ─── Body parsing + compression ───────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// ─── General rate limiting (all routes) ──────────────────────────────────────
app.use("/api/", generalLimiter);

// ─── Route imports ────────────────────────────────────────────────────────────
import userRouter from "./routes/user.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import watchProgressRouter from "./routes/watchProgress.routes.js";

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);        // ← only mounted ONCE (duplicate removed)
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/watch-progress", watchProgressRouter);

// ─── Global error handler (MUST be last) ─────────────────────────────────────
app.use(errorHandler);

export { app };
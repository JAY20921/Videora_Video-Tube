import { Router } from "express";
import { saveProgress, getProgress, getWatchHistory } from "../controllers/watchProgress.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { generalLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

// All watch-progress routes require authentication
router.use(verifyJWT);

// Save / upsert progress (called on heartbeat)
router.route("/").post(generalLimiter, saveProgress);

// Get progress for a specific video (called on VideoPage load)
router.route("/:videoId").get(getProgress);

// Get paginated watch history (for "Continue Watching" section)
router.route("/history").get(getWatchHistory);

export default router;

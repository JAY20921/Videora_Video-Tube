import { Router } from "express";
import { askQuestion, getTranscript, getAiStatus } from "../controllers/ai.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { generalLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

// AI status — public (for polling)
router.route("/status/:videoId").get(getAiStatus);

// All other AI routes require authentication
router.use(verifyJWT);

// RAG Tutor — ask a question about a video
router.route("/ask").post(generalLimiter, askQuestion);

// Get full transcript with chapters and concepts
router.route("/transcript/:videoId").get(getTranscript);

export default router;

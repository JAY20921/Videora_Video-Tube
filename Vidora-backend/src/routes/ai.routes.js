import { Router } from "express";
import { askQuestion, getTranscript, getAiStatus, generateSkillTree } from "../controllers/ai.controller.js";
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

// Generate Dynamic Skill-Tree Playlist
router.route("/skill-tree").post(generalLimiter, generateSkillTree);

export default router;

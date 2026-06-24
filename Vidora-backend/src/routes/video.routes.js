import { Router } from "express";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  getVideoStatus,
  publishAVideo,
  togglePublishStatus,
  updateVideo,
  incrementVideoView,
} from "../controllers/video.controller.js";
import { verifyJWT, optionalVerifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate, publishVideoSchema, updateVideoSchema } from "../middlewares/validate.middleware.js";

const router = Router();

// ─── Public routes (no auth required) ─────────────────────────────────────────

// Increment view count
router.route("/view/:videoId").post(incrementVideoView);

// Get all videos (browsing + search)
router.route("/").get(getAllVideos);

// Get a single video by ID — public so anyone can watch, but optional auth for sub status
router.route("/:videoId").get(optionalVerifyJWT, getVideoById);

// ─── Authenticated routes ─────────────────────────────────────────────────────
router.use(verifyJWT);

// Phase 3: Poll video processing status
router.route("/status/:videoId").get(getVideoStatus);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

router
  .route("/")
  .post(
    uploadLimiter,
    upload.fields([
      { name: "videoFile", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
    validate(publishVideoSchema),
    publishAVideo
  );

// Delete and update require auth — but GET is already handled above as public
router
  .route("/:videoId")
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), validate(updateVideoSchema), updateVideo);

export default router;

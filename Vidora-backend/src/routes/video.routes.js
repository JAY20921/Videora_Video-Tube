import { Router } from "express";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  togglePublishStatus,
  updateVideo,
  incrementVideoView,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate, publishVideoSchema, updateVideoSchema } from "../middlewares/validate.middleware.js";

const router = Router();

// Public: increment view count (no auth required)
router.route("/view/:videoId").post(incrementVideoView);

// Public: get all videos (browsing + search)
router.route("/").get(getAllVideos);

router.use(verifyJWT); // All routes below require authentication

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

router
  .route("/:videoId")
  .get(getVideoById)
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), validate(updateVideoSchema), updateVideo);

export default router;

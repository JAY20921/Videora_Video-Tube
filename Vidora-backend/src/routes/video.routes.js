import { Router } from 'express';
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

const router = Router();

// Public endpoint to increment views (do not require auth). Place before auth middleware.
router.route("/view/:videoId").post(incrementVideoView);

router.use(verifyJWT); // Apply verifyJWT middleware to protected routes in this file

// ---- FIX: PUT THIS ROUTE BEFORE :videoId ----
router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

// ---- Main Videos Route ----
router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
        ]),
        publishAVideo
    );

// ---- Dynamic videoId Route (MUST BE LAST) ----
router
    .route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch(upload.single("thumbnail"), updateVideo);

export default router;

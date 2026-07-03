import { Router } from "express";
import { ingestEvent, getVideoAnalytics } from "../controllers/analytics.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/event").post(verifyJWT, ingestEvent);
router.route("/video/:videoId").get(verifyJWT, getVideoAnalytics);

export default router;

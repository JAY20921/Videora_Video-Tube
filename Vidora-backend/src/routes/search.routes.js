import { Router } from "express";
import { instantSearch } from "../controllers/search.controller.js";

const router = Router();

// Public — no auth required for search
router.route("/").get(instantSearch);

export default router;

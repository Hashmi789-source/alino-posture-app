import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { progressController } from "../controllers/progress.controller";

const router = Router();

router.use(authMiddleware);

router.get("/daily/:deviceId", progressController.getDaily);
router.get("/monthly/:deviceId", progressController.getMonthly);

export default router;

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { postureReadingController } from "../controllers/postureReading.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", postureReadingController.create);
router.post("/bulk", postureReadingController.createBulk);
router.get("/latest/:deviceId", postureReadingController.getLatest);
router.get("/today/:deviceId", postureReadingController.getToday);
router.get("/", postureReadingController.list);

export default router;

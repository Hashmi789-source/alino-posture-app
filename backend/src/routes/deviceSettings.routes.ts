import { Router } from "express";
import { deviceSettingsController } from "../controllers/deviceSettings.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/", deviceSettingsController.save);
router.get("/:deviceId", deviceSettingsController.getByDevice);
router.patch("/:deviceId", deviceSettingsController.update);

export default router;

import { Router } from "express";
import { calibrationController } from "../controllers/calibration.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/", calibrationController.create);
router.get("/active/:deviceId", calibrationController.getActive);
router.get("/:deviceId", calibrationController.listByDevice);

export default router;

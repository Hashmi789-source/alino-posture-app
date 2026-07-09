import { Router } from "express";
import { deviceController } from "../controllers/device.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/", deviceController.create);
router.get("/", deviceController.list);
router.get("/:deviceId", deviceController.getById);
router.patch("/:deviceId", deviceController.update);
router.delete("/:deviceId", deviceController.remove);

export default router;

import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppError } from "../services/auth.service";
import { postureReadingService } from "../services/postureReading.service";
import {
  createBulkPostureReadingsSchema,
  createPostureReadingSchema,
  postureReadingDeviceIdParamsSchema,
  postureReadingQuerySchema,
} from "../validators/postureReading.validator";

const getAuthenticatedUserId = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const postureReadingController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = createPostureReadingSchema.parse(req.body);
      const reading = await postureReadingService.createReading(userId, input);

      res.status(201).json({
        success: true,
        message: "Posture reading created successfully",
        data: {
          reading,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async createBulk(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = createBulkPostureReadingsSchema.parse(req.body);
      const readings = await postureReadingService.createBulkReadings(userId, input);

      res.status(201).json({
        success: true,
        message: "Posture readings created successfully",
        data: {
          readings,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getLatest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = postureReadingDeviceIdParamsSchema.parse(req.params);
      const reading = await postureReadingService.getLatestReading(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Latest posture reading retrieved successfully",
        data: {
          reading,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getToday(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = postureReadingDeviceIdParamsSchema.parse(req.params);
      const readings = await postureReadingService.getTodayReadings(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Today's posture readings retrieved successfully",
        data: {
          readings,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = postureReadingQuerySchema.parse(req.query);
      const readings = await postureReadingService.getReadings(userId, input);

      res.status(200).json({
        success: true,
        message: "Posture readings retrieved successfully",
        data: {
          readings,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

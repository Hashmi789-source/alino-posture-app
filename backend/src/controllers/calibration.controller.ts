import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { calibrationService } from "../services/calibration.service";
import { AppError } from "../services/auth.service";
import { calibrationDeviceIdParamsSchema, createCalibrationSchema } from "../validators/calibration.validator";

const getAuthenticatedUserId = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const calibrationController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = createCalibrationSchema.parse(req.body);
      const calibration = await calibrationService.createCalibration(userId, input);

      res.status(201).json({
        success: true,
        message: "Calibration created successfully",
        data: {
          calibration,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getActive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = calibrationDeviceIdParamsSchema.parse(req.params);
      const calibration = await calibrationService.getActiveCalibration(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Active calibration retrieved successfully",
        data: {
          calibration,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async listByDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = calibrationDeviceIdParamsSchema.parse(req.params);
      const calibrations = await calibrationService.getCalibrationsByDevice(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Calibrations retrieved successfully",
        data: {
          calibrations,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

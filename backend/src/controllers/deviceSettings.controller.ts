import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppError } from "../services/auth.service";
import { deviceSettingsService } from "../services/deviceSettings.service";
import {
  createOrUpdateDeviceSettingsSchema,
  deviceSettingsDeviceIdParamsSchema,
  updateDeviceSettingsSchema,
} from "../validators/deviceSettings.validator";

const getAuthenticatedUserId = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const deviceSettingsController = {
  async save(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = createOrUpdateDeviceSettingsSchema.parse(req.body);
      const settings = await deviceSettingsService.createOrUpdateSettings(userId, input);

      res.status(200).json({
        success: true,
        message: "Device settings saved successfully",
        data: {
          settings,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getByDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceSettingsDeviceIdParamsSchema.parse(req.params);
      const settings = await deviceSettingsService.getSettings(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Device settings retrieved successfully",
        data: {
          settings,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceSettingsDeviceIdParamsSchema.parse(req.params);
      const input = updateDeviceSettingsSchema.parse(req.body);
      const settings = await deviceSettingsService.updateSettings(userId, deviceId, input);

      res.status(200).json({
        success: true,
        message: "Device settings updated successfully",
        data: {
          settings,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

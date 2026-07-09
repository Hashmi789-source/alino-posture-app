import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppError } from "../services/auth.service";
import { deviceService } from "../services/device.service";
import { createDeviceSchema, deviceIdParamsSchema, updateDeviceSchema } from "../validators/device.validator";

const getAuthenticatedUserId = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const deviceController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const input = createDeviceSchema.parse(req.body);
      const device = await deviceService.createDevice(userId, input);

      res.status(201).json({
        success: true,
        message: "Device created successfully",
        data: {
          device,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const devices = await deviceService.getDevices(userId);

      res.status(200).json({
        success: true,
        message: "Devices retrieved successfully",
        data: {
          devices,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceIdParamsSchema.parse(req.params);
      const device = await deviceService.getDeviceById(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Device retrieved successfully",
        data: {
          device,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceIdParamsSchema.parse(req.params);
      const input = updateDeviceSchema.parse(req.body);
      const device = await deviceService.updateDevice(userId, deviceId, input);

      res.status(200).json({
        success: true,
        message: "Device updated successfully",
        data: {
          device,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceIdParamsSchema.parse(req.params);

      await deviceService.deleteDevice(userId, deviceId);

      res.status(200).json({
        success: true,
        message: "Device deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};

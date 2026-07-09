import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AppError } from "../services/auth.service";
import { progressService } from "../services/progress.service";

const deviceIdParamsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
});

const dailyProgressQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format"),
});

const monthlyProgressQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must use YYYY-MM format"),
});

const getAuthenticatedUserId = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const progressController = {
  async getDaily(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceIdParamsSchema.parse(req.params);
      const { date } = dailyProgressQuerySchema.parse(req.query);
      const progress = await progressService.getDailyProgress(userId, deviceId, date);

      res.status(200).json({
        success: true,
        message: "Daily progress retrieved successfully",
        data: {
          progress,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getMonthly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = getAuthenticatedUserId(req);
      const { deviceId } = deviceIdParamsSchema.parse(req.params);
      const { month } = monthlyProgressQuerySchema.parse(req.query);
      const progress = await progressService.getMonthlyProgress(userId, deviceId, month);

      res.status(200).json({
        success: true,
        message: "Monthly progress retrieved successfully",
        data: {
          progress,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

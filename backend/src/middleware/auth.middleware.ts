import { NextFunction, Request, Response } from "express";
import { AuthUser, authService, AppError } from "../services/auth.service";

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export const authMiddleware = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Authorization token is required", 401);
    }

    const token = authHeader.slice("Bearer ".length).trim();

    if (!token) {
      throw new AppError("Authorization token is required", 401);
    }

    const payload = authService.verifyToken(token) as { userId: string; email?: string };

    try {
      req.user = await authService.getUserById(payload.userId);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        req.user = {
          id: payload.userId,
          name: payload.email?.split("@")[0] || "Device User",
          email: payload.email || "device@example.com",
          created_at: new Date().toISOString(),
        };
      } else {
        throw error;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

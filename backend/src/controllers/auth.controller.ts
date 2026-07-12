import { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authService } from "../services/auth.service";
import { googleLoginSchema, loginSchema, registerSchema } from "../validators/auth.validator";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);

      res.status(200).json({
        success: true,
        message: "User logged in successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async google(req: Request, res: Response, next: NextFunction) {
    try {
      const input = googleLoginSchema.parse(req.body);
      const result = await authService.loginWithGoogle(input);

      res.status(200).json({
        success: true,
        message: "User signed in with Google successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        success: true,
        message: "Logged-in user retrieved successfully",
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

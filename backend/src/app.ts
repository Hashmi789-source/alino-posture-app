import cors from "cors";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "./services/auth.service";
import authRoutes from "./routes/auth.routes";
import calibrationRoutes from "./routes/calibration.routes";
import deviceRoutes from "./routes/device.routes";
import healthRoutes from "./routes/health.routes";
import postureReadingRoutes from "./routes/postureReading.routes";
import progressRoutes from "./routes/progress.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/calibrations", calibrationRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/posture-readings", postureReadingRoutes);
app.use("/api/progress", progressRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : err.message,
  });
});

export default app;

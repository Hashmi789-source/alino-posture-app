import { z } from "zod";

const angle = (fieldName: string) =>
  z.number({
    error: `${fieldName} must be a valid number`,
  }).finite(`${fieldName} must be a valid number`);

export const createCalibrationSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
  baselineAngle: angle("Baseline angle"),
  thresholdAngle: angle("Threshold angle"),
});

export const calibrationDeviceIdParamsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
});

export type CreateCalibrationInput = z.infer<typeof createCalibrationSchema>;

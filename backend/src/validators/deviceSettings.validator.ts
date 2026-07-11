import { z } from "zod";

const sensitivity = z.enum(["low", "normal", "high"], {
  error: "Sensitivity must be low, normal, or high",
});

const thresholdAngle = z
  .number({
    error: "Threshold angle must be a valid number",
  })
  .finite("Threshold angle must be a valid number");

const vibrationDelaySeconds = z
  .number({
    error: "Vibration delay must be a valid number",
  })
  .int("Vibration delay must be a whole number")
  .min(0, "Vibration delay cannot be negative");

export const createDeviceSettingsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
  sensitivity,
  thresholdAngle,
  vibrationDelaySeconds,
  vibrationEnabled: z.boolean({
    error: "Vibration enabled must be true or false",
  }),
});

export const updateDeviceSettingsSchema = z
  .object({
    sensitivity: sensitivity.optional(),
    thresholdAngle: thresholdAngle.optional(),
    vibrationDelaySeconds: vibrationDelaySeconds.optional(),
    vibrationEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const deviceSettingsDeviceIdParamsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
});

export type CreateDeviceSettingsInput = z.infer<typeof createDeviceSettingsSchema>;
export type UpdateDeviceSettingsInput = z.infer<typeof updateDeviceSettingsSchema>;

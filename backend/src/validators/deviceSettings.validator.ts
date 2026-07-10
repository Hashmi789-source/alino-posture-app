import { z } from "zod";

const sensitivity = z.enum(["low", "normal", "high"], {
  error: "Sensitivity must be low, normal, or high",
});

const angle = z
  .number({
    error: "Threshold angle must be a valid number",
  })
  .finite("Threshold angle must be a valid number")
  .min(0, "Threshold angle cannot be negative");

const vibrationDelaySeconds = z
  .number({
    error: "Vibration delay seconds must be a valid number",
  })
  .int("Vibration delay seconds must be a whole number")
  .min(0, "Vibration delay seconds cannot be negative");

export const createOrUpdateDeviceSettingsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
  sensitivity,
  thresholdAngle: angle,
  vibrationDelaySeconds,
  vibrationEnabled: z.boolean({
    error: "Vibration enabled must be true or false",
  }),
});

export const updateDeviceSettingsSchema = z
  .object({
    sensitivity: sensitivity.optional(),
    thresholdAngle: angle.optional(),
    vibrationDelaySeconds: vibrationDelaySeconds.optional(),
    vibrationEnabled: z
      .boolean({
        error: "Vibration enabled must be true or false",
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const deviceSettingsDeviceIdParamsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
});

export type CreateOrUpdateDeviceSettingsInput = z.infer<typeof createOrUpdateDeviceSettingsSchema>;
export type UpdateDeviceSettingsInput = z.infer<typeof updateDeviceSettingsSchema>;

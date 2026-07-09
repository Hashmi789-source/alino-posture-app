import { z } from "zod";

const validDateString = (fieldName: string) =>
  z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: `${fieldName} must be a valid date`,
  });

const angle = z
  .number({
    error: "Angle must be a valid number",
  })
  .finite("Angle must be a valid number");

const postureStatus = z.enum(["good", "wrong", "unknown"], {
  error: "Posture status must be good, wrong, or unknown",
});

export const createPostureReadingSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
  angle,
  postureStatus,
  recordedAt: validDateString("Recorded at"),
});

const bulkReadingSchema = z.object({
  angle,
  postureStatus,
  recordedAt: validDateString("Recorded at"),
});

export const createBulkPostureReadingsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
  readings: z.array(bulkReadingSchema).min(1, "At least one reading is required"),
});

export const postureReadingDeviceIdParamsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
});

export const postureReadingQuerySchema = z
  .object({
    deviceId: z.string().uuid("Valid device id is required"),
    from: validDateString("From").optional(),
    to: validDateString("To").optional(),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) {
        return true;
      }

      return Date.parse(value.from) <= Date.parse(value.to);
    },
    {
      message: "From date must be before or equal to to date",
      path: ["from"],
    },
  );

export type CreatePostureReadingInput = z.infer<typeof createPostureReadingSchema>;
export type CreateBulkPostureReadingsInput = z.infer<typeof createBulkPostureReadingsSchema>;
export type PostureReadingQueryInput = z.infer<typeof postureReadingQuerySchema>;

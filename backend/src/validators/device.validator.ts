import { z } from "zod";

const deviceName = z.string().trim().min(1, "Device name is required");
const deviceUid = z.string().trim().min(1, "Device UID is required");
const deviceIp = z
  .string()
  .trim()
  .regex(
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/,
    "Valid device IP is required",
  );

export const createDeviceSchema = z.object({
  deviceName,
  deviceUid,
  deviceIp,
});

export const updateDeviceSchema = z
  .object({
    deviceName: deviceName.optional(),
    deviceUid: deviceUid.optional(),
    deviceIp: deviceIp.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const deviceIdParamsSchema = z.object({
  deviceId: z.string().uuid("Valid device id is required"),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

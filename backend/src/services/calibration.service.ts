import { supabase } from "../config/supabase";
import { CreateCalibrationInput } from "../validators/calibration.validator";
import { AppError } from "./auth.service";

type CalibrationRow = {
  id: string;
  user_id: string;
  device_id: string;
  baseline_angle: number;
  threshold_angle: number;
  is_active: boolean;
  created_at: string;
};

const calibrationColumns = "id, user_id, device_id, baseline_angle, threshold_angle, is_active, created_at";

const requireSupabase = () => {
  if (!supabase) {
    throw new AppError("Database is not configured", 500);
  }

  return supabase;
};

const toCalibrationResponse = (calibration: CalibrationRow) => ({
  id: calibration.id,
  userId: calibration.user_id,
  deviceId: calibration.device_id,
  baselineAngle: calibration.baseline_angle,
  thresholdAngle: calibration.threshold_angle,
  isActive: calibration.is_active,
  createdAt: calibration.created_at,
});

const ensureUserRecord = async (userId: string) => {
  const db = requireSupabase();

  const { data: existingUser, error: lookupError } = await db.from("users").select("id").eq("id", userId).maybeSingle();

  if (lookupError) {
    throw new AppError(lookupError.message, 500);
  }

  if (existingUser) {
    return;
  }

  const { error: createError } = await db.from("users").insert({
    id: userId,
    name: "Device User",
    email: `device-${userId.replace(/-/g, "")}@alino.local`,
    password_hash: "device-placeholder",
  });

  if (createError) {
    throw new AppError(createError.message, 500);
  }
};

const verifyDeviceOwnership = async (userId: string, deviceId: string) => {
  const db = requireSupabase();

  await ensureUserRecord(userId);

  const { data: device, error } = await db.from("devices").select("id, user_id").eq("id", deviceId).maybeSingle();

  if (error) {
    throw new AppError(error.message, 500);
  }

  if (device) {
    if (device.user_id !== userId) {
      throw new AppError("Device not found", 404);
    }
    return;
  }

  const { error: createError } = await db.from("devices").insert({
    id: deviceId,
    user_id: userId,
    device_name: "Firmware Device",
    device_uid: deviceId,
    device_ip: null,
  });

  if (createError) {
    throw new AppError(createError.message, 500);
  }
};

export const calibrationService = {
  async createCalibration(userId: string, input: CreateCalibrationInput) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, input.deviceId);

    const { error: deactivateError } = await db
      .from("calibrations")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("device_id", input.deviceId)
      .eq("is_active", true);

    if (deactivateError) {
      throw new AppError(deactivateError.message, 500);
    }

    const { data: calibration, error } = await db
      .from("calibrations")
      .insert({
        user_id: userId,
        device_id: input.deviceId,
        baseline_angle: input.baselineAngle,
        threshold_angle: input.thresholdAngle,
        is_active: true,
      })
      .select(calibrationColumns)
      .single();

    if (error || !calibration) {
      throw new AppError(error?.message || "Could not create calibration", 500);
    }

    return toCalibrationResponse(calibration);
  },

  async getActiveCalibration(userId: string, deviceId: string) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, deviceId);

    const { data: calibration, error } = await db
      .from("calibrations")
      .select(calibrationColumns)
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!calibration) {
      throw new AppError("Active calibration not found", 404);
    }

    return toCalibrationResponse(calibration);
  },

  async getCalibrationsByDevice(userId: string, deviceId: string) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, deviceId);

    const { data: calibrations, error } = await db
      .from("calibrations")
      .select(calibrationColumns)
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(error.message, 500);
    }

    return (calibrations || []).map(toCalibrationResponse);
  },
};

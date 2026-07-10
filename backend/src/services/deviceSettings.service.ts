import { supabase } from "../config/supabase";
import { AppError } from "./auth.service";
import {
  CreateOrUpdateDeviceSettingsInput,
  UpdateDeviceSettingsInput,
} from "../validators/deviceSettings.validator";

type DeviceSettingsRow = {
  id: string;
  user_id: string;
  device_id: string;
  sensitivity: "low" | "normal" | "high";
  threshold_angle: number;
  vibration_delay_seconds: number;
  vibration_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type DeviceSettingsUpdate = Partial<
  Pick<DeviceSettingsRow, "sensitivity" | "threshold_angle" | "vibration_delay_seconds" | "vibration_enabled">
>;

const deviceSettingsColumns =
  "id, user_id, device_id, sensitivity, threshold_angle, vibration_delay_seconds, vibration_enabled, created_at, updated_at";

const requireSupabase = () => {
  if (!supabase) {
    throw new AppError("Database is not configured", 500);
  }

  return supabase;
};

const toDeviceSettingsResponse = (settings: DeviceSettingsRow) => ({
  id: settings.id,
  userId: settings.user_id,
  deviceId: settings.device_id,
  sensitivity: settings.sensitivity,
  thresholdAngle: settings.threshold_angle,
  vibrationDelaySeconds: settings.vibration_delay_seconds,
  vibrationEnabled: settings.vibration_enabled,
  createdAt: settings.created_at,
  updatedAt: settings.updated_at,
});

const verifyDeviceOwnership = async (userId: string, deviceId: string) => {
  const db = requireSupabase();

  const { data: device, error } = await db
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500);
  }

  if (!device) {
    throw new AppError("Device not found", 404);
  }
};

const buildDeviceSettingsUpdate = (input: UpdateDeviceSettingsInput): DeviceSettingsUpdate => {
  const update: DeviceSettingsUpdate = {};

  if (input.sensitivity !== undefined) {
    update.sensitivity = input.sensitivity;
  }

  if (input.thresholdAngle !== undefined) {
    update.threshold_angle = input.thresholdAngle;
  }

  if (input.vibrationDelaySeconds !== undefined) {
    update.vibration_delay_seconds = input.vibrationDelaySeconds;
  }

  if (input.vibrationEnabled !== undefined) {
    update.vibration_enabled = input.vibrationEnabled;
  }

  return update;
};

export const deviceSettingsService = {
  async createOrUpdateSettings(userId: string, input: CreateOrUpdateDeviceSettingsInput) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, input.deviceId);

    const { data: settings, error } = await db
      .from("device_settings")
      .upsert(
        {
          user_id: userId,
          device_id: input.deviceId,
          sensitivity: input.sensitivity,
          threshold_angle: input.thresholdAngle,
          vibration_delay_seconds: input.vibrationDelaySeconds,
          vibration_enabled: input.vibrationEnabled,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "device_id",
        },
      )
      .select(deviceSettingsColumns)
      .single();

    if (error || !settings) {
      throw new AppError(error?.message || "Could not save device settings", 500);
    }

    return toDeviceSettingsResponse(settings);
  },

  async getSettings(userId: string, deviceId: string) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, deviceId);

    const { data: settings, error } = await db
      .from("device_settings")
      .select(deviceSettingsColumns)
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!settings) {
      throw new AppError("Device settings not found", 404);
    }

    return toDeviceSettingsResponse(settings);
  },

  async updateSettings(userId: string, deviceId: string, input: UpdateDeviceSettingsInput) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, deviceId);

    const { data: settings, error } = await db
      .from("device_settings")
      .update({
        ...buildDeviceSettingsUpdate(input),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .select(deviceSettingsColumns)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!settings) {
      throw new AppError("Device settings not found", 404);
    }

    return toDeviceSettingsResponse(settings);
  },
};

import { supabase } from "../config/supabase";
import { AppError } from "./auth.service";
import { CreateDeviceInput, UpdateDeviceInput } from "../validators/device.validator";

type DeviceRow = {
  id: string;
  user_id: string;
  device_name: string;
  device_uid: string;
  device_ip: string | null;
  created_at: string;
};

const deviceColumns = "id, user_id, device_name, device_uid, device_ip, created_at";

const requireSupabase = () => {
  if (!supabase) {
    throw new AppError("Database is not configured", 500);
  }

  return supabase;
};

const toDeviceResponse = (device: DeviceRow) => ({
  id: device.id,
  userId: device.user_id,
  deviceName: device.device_name,
  deviceUid: device.device_uid,
  deviceIp: device.device_ip,
  createdAt: device.created_at,
});

const buildDeviceUpdate = (input: UpdateDeviceInput) => {
  const update: Partial<Pick<DeviceRow, "device_name" | "device_uid" | "device_ip">> = {};

  if (input.deviceName !== undefined) {
    update.device_name = input.deviceName;
  }

  if (input.deviceUid !== undefined) {
    update.device_uid = input.deviceUid;
  }

  if (input.deviceIp !== undefined) {
    update.device_ip = input.deviceIp;
  }

  return update;
};

export const deviceService = {
  async createDevice(userId: string, input: CreateDeviceInput) {
    const db = requireSupabase();

    const { data: existingDevice, error: lookupError } = await db
      .from("devices")
      .select(deviceColumns)
      .eq("device_uid", input.deviceUid)
      .maybeSingle();

    if (lookupError) {
      throw new AppError(lookupError.message, 500);
    }

    if (existingDevice) {
      if (existingDevice.user_id !== userId) {
        throw new AppError("This Alino device is already connected to another account", 409);
      }

      const { data: updatedDevice, error: updateError } = await db
        .from("devices")
        .update({ device_name: input.deviceName, device_ip: input.deviceIp })
        .eq("id", existingDevice.id)
        .eq("user_id", userId)
        .select(deviceColumns)
        .single();

      if (updateError || !updatedDevice) {
        throw new AppError(updateError?.message || "Could not reconnect device", 500);
      }

      return toDeviceResponse(updatedDevice);
    }

    const { data: device, error } = await db
      .from("devices")
      .insert({
        user_id: userId,
        device_name: input.deviceName,
        device_uid: input.deviceUid,
        device_ip: input.deviceIp,
      })
      .select(deviceColumns)
      .single();

    if (error || !device) {
      throw new AppError(error?.message || "Could not create device", error?.code === "23505" ? 409 : 500);
    }

    return toDeviceResponse(device);
  },

  async getDevices(userId: string) {
    const db = requireSupabase();

    const { data: devices, error } = await db
      .from("devices")
      .select(deviceColumns)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError(error.message, 500);
    }

    return (devices || []).map(toDeviceResponse);
  },

  async getDeviceById(userId: string, deviceId: string) {
    const db = requireSupabase();

    const { data: device, error } = await db
      .from("devices")
      .select(deviceColumns)
      .eq("id", deviceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!device) {
      throw new AppError("Device not found", 404);
    }

    return toDeviceResponse(device);
  },

  async updateDevice(userId: string, deviceId: string, input: UpdateDeviceInput) {
    const db = requireSupabase();

    const { data: device, error } = await db
      .from("devices")
      .update(buildDeviceUpdate(input))
      .eq("id", deviceId)
      .eq("user_id", userId)
      .select(deviceColumns)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, error.code === "23505" ? 409 : 500);
    }

    if (!device) {
      throw new AppError("Device not found", 404);
    }

    return toDeviceResponse(device);
  },

  async deleteDevice(userId: string, deviceId: string) {
    const db = requireSupabase();

    await this.getDeviceById(userId, deviceId);

    const { error } = await db.from("devices").delete().eq("id", deviceId).eq("user_id", userId);

    if (error) {
      throw new AppError(error.message, 500);
    }
  },
};

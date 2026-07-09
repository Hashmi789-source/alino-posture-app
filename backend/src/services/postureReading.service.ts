import { supabase } from "../config/supabase";
import {
  CreateBulkPostureReadingsInput,
  CreatePostureReadingInput,
  PostureReadingQueryInput,
} from "../validators/postureReading.validator";
import { AppError } from "./auth.service";

type PostureReadingRow = {
  id: string;
  user_id: string;
  device_id: string;
  angle: number;
  posture_status: "good" | "wrong" | "unknown";
  recorded_at: string;
  created_at: string;
};

type PostureReadingInsert = {
  user_id: string;
  device_id: string;
  angle: number;
  posture_status: "good" | "wrong" | "unknown";
  recorded_at: string;
};

const postureReadingColumns = "id, user_id, device_id, angle, posture_status, recorded_at, created_at";

const requireSupabase = () => {
  if (!supabase) {
    throw new AppError("Database is not configured", 500);
  }

  return supabase;
};

const toPostureReadingResponse = (reading: PostureReadingRow) => ({
  id: reading.id,
  userId: reading.user_id,
  deviceId: reading.device_id,
  angle: reading.angle,
  postureStatus: reading.posture_status,
  recordedAt: reading.recorded_at,
  createdAt: reading.created_at,
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

const toRecordedAtIso = (recordedAt: string) => new Date(recordedAt).toISOString();

const getTodayBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
};

export const postureReadingService = {
  async createReading(userId: string, input: CreatePostureReadingInput) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, input.deviceId);

    const { data: reading, error } = await db
      .from("posture_readings")
      .insert({
        user_id: userId,
        device_id: input.deviceId,
        angle: input.angle,
        posture_status: input.postureStatus,
        recorded_at: toRecordedAtIso(input.recordedAt),
      })
      .select(postureReadingColumns)
      .single();

    if (error || !reading) {
      throw new AppError(error?.message || "Could not create posture reading", 500);
    }

    return toPostureReadingResponse(reading);
  },

  async createBulkReadings(userId: string, input: CreateBulkPostureReadingsInput) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, input.deviceId);

    const readingsToInsert: PostureReadingInsert[] = input.readings.map((reading) => ({
      user_id: userId,
      device_id: input.deviceId,
      angle: reading.angle,
      posture_status: reading.postureStatus,
      recorded_at: toRecordedAtIso(reading.recordedAt),
    }));

    const { data: readings, error } = await db
      .from("posture_readings")
      .insert(readingsToInsert)
      .select(postureReadingColumns);

    if (error || !readings) {
      throw new AppError(error?.message || "Could not create posture readings", 500);
    }

    return readings.map(toPostureReadingResponse);
  },

  async getLatestReading(userId: string, deviceId: string) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, deviceId);

    const { data: reading, error } = await db
      .from("posture_readings")
      .select(postureReadingColumns)
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .order("recorded_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!reading) {
      throw new AppError("Posture reading not found", 404);
    }

    return toPostureReadingResponse(reading);
  },

  async getTodayReadings(userId: string, deviceId: string) {
    const db = requireSupabase();
    const { from, to } = getTodayBounds();

    await verifyDeviceOwnership(userId, deviceId);

    const { data: readings, error } = await db
      .from("posture_readings")
      .select(postureReadingColumns)
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .gte("recorded_at", from)
      .lt("recorded_at", to)
      .order("recorded_at", { ascending: false });

    if (error) {
      throw new AppError(error.message, 500);
    }

    return (readings || []).map(toPostureReadingResponse);
  },

  async getReadings(userId: string, input: PostureReadingQueryInput) {
    const db = requireSupabase();

    await verifyDeviceOwnership(userId, input.deviceId);

    let query = db
      .from("posture_readings")
      .select(postureReadingColumns)
      .eq("user_id", userId)
      .eq("device_id", input.deviceId)
      .order("recorded_at", { ascending: false });

    if (input.from) {
      query = query.gte("recorded_at", toRecordedAtIso(input.from));
    }

    if (input.to) {
      query = query.lte("recorded_at", toRecordedAtIso(input.to));
    }

    const { data: readings, error } = await query;

    if (error) {
      throw new AppError(error.message, 500);
    }

    return (readings || []).map(toPostureReadingResponse);
  },
};

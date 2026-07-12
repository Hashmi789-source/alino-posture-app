import { supabase } from "../config/supabase";
import { AppError } from "./auth.service";

type PostureStatus = "good" | "wrong" | "unknown";

type ProgressReadingRow = {
  angle: number;
  posture_status: PostureStatus;
  recorded_at: string;
};

type ProgressSummary = {
  totalReadings: number;
  goodReadings: number;
  wrongReadings: number;
  unknownReadings: number;
  averageAngle: number;
  postureScore: number;
};

const progressReadingColumns = "angle, posture_status, recorded_at";

const requireSupabase = () => {
  if (!supabase) {
    throw new AppError("Database is not configured", 500);
  }

  return supabase;
};

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

const pad = (value: number) => value.toString().padStart(2, "0");

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const parseDateKey = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const parseMonthKey = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const summarizeReadings = (readings: ProgressReadingRow[]): ProgressSummary => {
  const totalReadings = readings.length;
  const goodReadings = readings.filter((reading) => reading.posture_status === "good").length;
  const wrongReadings = readings.filter((reading) => reading.posture_status === "wrong").length;
  const unknownReadings = readings.filter((reading) => reading.posture_status === "unknown").length;
  const totalAngle = readings.reduce((sum, reading) => sum + Number(reading.angle), 0);

  return {
    totalReadings,
    goodReadings,
    wrongReadings,
    unknownReadings,
    averageAngle: totalReadings > 0 ? roundToTwo(totalAngle / totalReadings) : 0,
    postureScore: totalReadings > 0 ? roundToTwo((goodReadings / totalReadings) * 100) : 0,
  };
};

const fetchReadingsForRange = async (userId: string, deviceId: string, from: string, to: string) => {
  const db = requireSupabase();

  const { data: readings, error } = await db
    .from("posture_readings")
    .select(progressReadingColumns)
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .gte("recorded_at", from)
    .lt("recorded_at", to)
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new AppError(error.message, 500);
  }

  return readings || [];
};

export const progressService = {
  async getDailyProgress(userId: string, deviceId: string, date: string) {
    await verifyDeviceOwnership(userId, deviceId);

    const start = parseDateKey(date);
    const end = addDays(start, 1);
    const readings = await fetchReadingsForRange(userId, deviceId, start.toISOString(), end.toISOString());
    const summary = summarizeReadings(readings);

    return {
      date,
      deviceId,
      ...summary,
    };
  },

  async getMonthlyProgress(userId: string, deviceId: string, month: string) {
    await verifyDeviceOwnership(userId, deviceId);

    const start = parseMonthKey(month);
    const end = addMonths(start, 1);
    const readings = await fetchReadingsForRange(userId, deviceId, start.toISOString(), end.toISOString());
    const monthlySummary = summarizeReadings(readings);
    const readingsByDate = readings.reduce<Record<string, ProgressReadingRow[]>>((groups, reading) => {
      const dateKey = toDateKey(new Date(reading.recorded_at));

      return {
        ...groups,
        [dateKey]: [...(groups[dateKey] || []), reading],
      };
    }, {});
    const days = [];

    for (let day = new Date(start); day < end; day = addDays(day, 1)) {
      const date = toDateKey(day);
      const summary = summarizeReadings(readingsByDate[date] || []);

      days.push({
        date,
        postureScore: summary.postureScore,
        averageAngle: summary.averageAngle,
        goodReadings: summary.goodReadings,
        wrongReadings: summary.wrongReadings,
        unknownReadings: summary.unknownReadings,
        totalReadings: summary.totalReadings,
      });
    }

    return {
      month: toMonthKey(start),
      deviceId,
      monthlyAverageScore: monthlySummary.postureScore,
      averageAngle: monthlySummary.averageAngle,
      totalReadings: monthlySummary.totalReadings,
      goodReadings: monthlySummary.goodReadings,
      wrongReadings: monthlySummary.wrongReadings,
      unknownReadings: monthlySummary.unknownReadings,
      days,
    };
  },
};

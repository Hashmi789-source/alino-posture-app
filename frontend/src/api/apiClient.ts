export type ApiUser = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  created_at?: string;
};

export type Device = {
  id: string;
  userId: string;
  deviceName: string;
  deviceUid: string;
  deviceIp: string;
  createdAt: string;
};

export type Calibration = {
  id: string;
  deviceId: string;
  baselineAngle: number;
  thresholdAngle: number;
  isActive: boolean;
  createdAt: string;
};

export type PostureStatus = "good" | "wrong" | "unknown";

export type PostureReading = {
  id: string;
  deviceId: string;
  angle: number;
  postureStatus: PostureStatus;
  recordedAt: string;
  createdAt: string;
};

export type ProgressSummary = {
  date?: string;
  month?: string;
  deviceId: string;
  totalReadings: number;
  goodReadings: number;
  wrongReadings: number;
  unknownReadings: number;
  averageAngle: number;
  postureScore?: number;
  monthlyAverageScore?: number;
  days?: Array<{
    date: string;
    postureScore: number;
    averageAngle: number;
    goodReadings: number;
    wrongReadings: number;
    unknownReadings: number;
    totalReadings: number;
  }>;
};

export type DeviceSettings = {
  id: string;
  deviceId: string;
  sensitivity: "low" | "normal" | "high";
  thresholdAngle: number;
  vibrationDelaySeconds: number;
  vibrationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
let alinoDeviceBaseUrl = "http://192.168.4.1";
export const setAlinoDeviceUrl = (ip: string) => {
  // AP mode uses port 80, STA mode (same network) uses port 8080
  const port = ip === "192.168.4.1" ? "" : ":8080";
  alinoDeviceBaseUrl = `http://${ip}${port}`;
};
const TOKEN_KEY = "alino_auth_token";

export type AlinoDeviceInfo = {
  deviceUid: string;
  deviceName: string;
  firmwareVersion: string;
  sensorReady: boolean;
  calibrated: boolean;
  deviceIp?: string;
  batteryVoltage?: number;
  batteryPercent?: number;
  angle?: number;
  bendDirection?: "none" | "forward" | "backward" | "left" | "right";
};

export type AlinoCalibrationResult = {
  success: boolean;
  baselineAngle: number;
  thresholdAngle: number;
  message: string;
};

export type AlinoActionResult = {
  success: boolean;
  message: string;
};

export const tokenStore = {
  get() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

const formatError = (payload: ApiResponse<unknown>) => {
  if (payload.errors?.length) {
    return payload.errors.map((error) => `${error.field}: ${error.message}`).join(", ");
  }

  return payload.message || "Request failed";
};

async function request<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = tokenStore.get();

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      cache: "no-store",
      headers,
    });
    const payload = (await response.json().catch(() => ({
      success: false,
      message: "Invalid server response",
    }))) as ApiResponse<T>;

    if (!response.ok || !payload.success) {
      throw new Error(formatError(payload));
    }

    return payload.data as T;
  } catch (error) {
    console.warn("Backend request failed:", path, error);
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the backend at ${API_BASE_URL}. Start the backend server or set VITE_API_BASE_URL correctly.`,
      );
    }
    throw error;
  }
}

async function requestDevice<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${alinoDeviceBaseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Alino device request failed");
    return payload as T;
  } catch {
    throw new Error(`Unable to reach your Alino device at ${alinoDeviceBaseUrl}. Make sure the IP is correct and both devices are on the same network.`);
  } finally {
    window.clearTimeout(timeout);
  }
}

export const alinoDevice = {
  info() {
    return requestDevice<AlinoDeviceInfo>("/api/device/info");
  },
  calibrate() {
    return requestDevice<AlinoCalibrationResult>("/api/calibrate", { method: "POST" });
  },
  testMotor() {
    return requestDevice<AlinoActionResult>("/api/device/test-motor", { method: "POST" });
  },
  stopMotor() {
    return requestDevice<AlinoActionResult>("/api/device/stop-motor", { method: "POST" });
  },
  provision(input: { ssid: string; password: string; apiHost?: string }) {
    return requestDevice<AlinoActionResult>("/api/device/provision", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export const api = {
  auth: {
    async register(input: { name: string; email: string; password: string }) {
      return request<{ user: ApiUser; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async login(input: { email: string; password: string }) {
      return request<{ user: ApiUser; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async google(credential: string) {
      return request<{ user: ApiUser; token: string }>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
    },
    async me() {
      return request<{ user: ApiUser }>("/auth/me");
    },
  },
  devices: {
    async create(input: { deviceName: string; deviceUid: string; deviceIp: string }) {
      return request<{ device: Device }>("/devices", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async list() {
      return request<{ devices: Device[] }>("/devices");
    },
    async update(deviceId: string, input: Partial<{ deviceName: string; deviceUid: string; deviceIp: string }>) {
      return request<{ device: Device }>(`/devices/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    async remove(deviceId: string) {
      return request<void>(`/devices/${deviceId}`, {
        method: "DELETE",
      });
    },
  },
  calibrations: {
    async create(input: { deviceId: string; baselineAngle: number; thresholdAngle: number }) {
      return request<{ calibration: Calibration }>("/calibrations", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async active(deviceId: string) {
      return request<{ calibration: Calibration }>(`/calibrations/active/${deviceId}`);
    },
    async list(deviceId: string) {
      return request<{ calibrations: Calibration[] }>(`/calibrations/${deviceId}`);
    },
  },
  readings: {
    async create(input: { deviceId: string; angle: number; postureStatus: PostureStatus; recordedAt: string }) {
      return request<{ reading: PostureReading }>("/posture-readings", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async latest(deviceId: string) {
      return request<{ reading: PostureReading }>(`/posture-readings/latest/${deviceId}`);
    },
    async today(deviceId: string) {
      return request<{ readings: PostureReading[] }>(`/posture-readings/today/${deviceId}`);
    },
  },
  progress: {
    async daily(deviceId: string, date: string) {
      return request<{ progress: ProgressSummary }>(`/progress/daily/${deviceId}?date=${date}`);
    },
    async monthly(deviceId: string, month: string) {
      return request<{ progress: ProgressSummary }>(`/progress/monthly/${deviceId}?month=${month}`);
    },
  },
  settings: {
    async save(input: {
      deviceId: string;
      sensitivity: DeviceSettings["sensitivity"];
      thresholdAngle: number;
      vibrationDelaySeconds: number;
      vibrationEnabled: boolean;
    }) {
      return request<{ settings: DeviceSettings }>("/device-settings", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async get(deviceId: string) {
      return request<{ settings: DeviceSettings }>(`/device-settings/${deviceId}`);
    },
    async update(
      deviceId: string,
      input: Partial<Pick<DeviceSettings, "sensitivity" | "thresholdAngle" | "vibrationDelaySeconds" | "vibrationEnabled">>,
    ) {
      return request<{ settings: DeviceSettings }>(`/device-settings/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
  },
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, DEVICE_BASE_URL } from '../config/environment';
import type { AuthResponse, Device, DeviceSettings, EspCalibration, EspDeviceInfo, Progress } from '../types';

const TOKEN_KEY = 'alino.jwt';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Request failed with status ${response.status}`);
  return data as T;
}

async function deviceRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DEVICE_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Device request failed with status ${response.status}`);
  return data as T;
}

export const tokenStore = {
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

export const api = {
  register: (body: { name: string; email: string; password: string }) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<{ user: AuthResponse['user'] }>('/auth/me'),
  createDevice: (body: { deviceName: string; deviceUid: string; deviceIp: string }) => request<Device>('/devices', { method: 'POST', body: JSON.stringify(body) }),
  getDevices: () => request<Device[]>('/devices'),
  getDevice: (deviceId: string) => request<Device>(`/devices/${deviceId}`),
  createCalibration: (body: { deviceId: string; baselineAngle: number; thresholdAngle: number }) => request('/calibrations', { method: 'POST', body: JSON.stringify(body) }),
  getActiveCalibration: (deviceId: string) => request(`/calibrations/active/${deviceId}`),
  latestReading: (deviceId: string) => request(`/posture-readings/latest/${deviceId}`),
  todayReadings: (deviceId: string) => request(`/posture-readings/today/${deviceId}`),
  dailyProgress: (deviceId: string, date: string) => request<Progress>(`/progress/daily/${deviceId}?date=${date}`),
  monthlyProgress: (deviceId: string, month: string) => request<Progress>(`/progress/monthly/${deviceId}?month=${month}`),
  createSettings: (body: DeviceSettings) => request('/device-settings', { method: 'POST', body: JSON.stringify(body) }),
  getSettings: (deviceId: string) => request<DeviceSettings>(`/device-settings/${deviceId}`),
  updateSettings: (deviceId: string, body: Partial<DeviceSettings>) => request<DeviceSettings>(`/device-settings/${deviceId}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const esp32 = {
  getDeviceInfo: () => deviceRequest<EspDeviceInfo>('/device/info'),
  calibrate: () => deviceRequest<EspCalibration>('/calibrate', { method: 'POST' }),
};

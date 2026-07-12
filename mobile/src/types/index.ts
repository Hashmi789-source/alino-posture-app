export type ScreenName =
  | 'Login'
  | 'Register'
  | 'Dashboard'
  | 'ConnectDevice'
  | 'Calibration'
  | 'LivePosture'
  | 'DailyProgress'
  | 'MonthlyProgress'
  | 'DeviceSettings'
  | 'HowToUse';

export type User = { id: string; email: string; name?: string };
export type Device = { id: string; deviceName: string; deviceUid: string; deviceIp?: string };
export type AuthResponse = { token: string; user: User };
export type EspDeviceInfo = { deviceUid: string; deviceName: string; firmwareVersion: string; sensorReady: boolean; calibrated: boolean };
export type EspCalibration = { success: boolean; baselineAngle: number; thresholdAngle: number; message: string };
export type PostureReading = { id?: string; deviceId: string; angle: number; postureStatus?: 'good' | 'warning' | 'bad' | 'unknown'; createdAt?: string };
export type Progress = { postureScore?: number; goodPostureMinutes?: number; wrongPostureMinutes?: number; alertCount?: number; averageAngle?: number };
export type DeviceSettings = { deviceId: string; alertEnabled: boolean; vibrationEnabled: boolean; thresholdAngle: number };

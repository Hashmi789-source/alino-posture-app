# Alino Posture App Testing Guide

## Backend Setup

From the `backend` folder:

```bash
npm install
cp .env.example .env
npm run dev
```

Set these environment variables in `backend/.env`:

```text
PORT=5000
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
```

Never commit `.env`, `node_modules`, or `dist`.

## Build Check

```bash
cd backend
npm run build
```

## Health Check

```bash
curl http://localhost:5000/api/health
```

`localhost` only works on the computer running the backend. Use that computer's network IP address when testing from a phone or ESP32.

## Manual API Flow

Use a REST client such as Postman, Insomnia, Thunder Client, or curl.

1. Register a user with `POST /api/auth/register`.
2. Copy the returned JWT token.
3. Add `Authorization: Bearer <JWT_TOKEN>` to protected requests.
4. Create a device with `POST /api/devices`.
5. Copy the returned `device.id`.
6. Save settings with `POST /api/device-settings`.
7. Create a calibration with `POST /api/calibrations`.
8. Send single or bulk posture readings with `/api/posture-readings`.
9. Check latest, daily, and monthly progress endpoints.

## Sample Requests

### Device

```json
{
  "deviceName": "Alino Device 01",
  "deviceUid": "ESP32_001",
  "deviceIp": "192.168.4.1"
}
```

### Device Settings

```json
{
  "deviceId": "uuid-device-id",
  "sensitivity": "normal",
  "thresholdAngle": 12,
  "vibrationDelaySeconds": 60,
  "vibrationEnabled": true
}
```

### Calibration

```json
{
  "deviceId": "uuid-device-id",
  "baselineAngle": 8.5,
  "thresholdAngle": 12
}
```

### Single Posture Reading

```json
{
  "deviceId": "uuid-device-id",
  "angle": 18.5,
  "postureStatus": "good",
  "recordedAt": "2026-07-08T10:40:00Z"
}
```

### Bulk Posture Readings

```json
{
  "deviceId": "uuid-device-id",
  "readings": [
    {
      "angle": 18.5,
      "postureStatus": "good",
      "recordedAt": "2026-07-08T10:42:00Z"
    },
    {
      "angle": 26.1,
      "postureStatus": "wrong",
      "recordedAt": "2026-07-08T10:43:00Z"
    }
  ]
}
```

## Expected Device Settings Behavior

- Requests without a JWT return `401`.
- Settings for another user's device return `404`.
- `POST /api/device-settings` creates settings when none exist.
- Repeating `POST /api/device-settings` updates the one existing settings row for that device.
- `PATCH /api/device-settings/:deviceId` updates selected fields only.
- Invalid `sensitivity` values return `400`.

## Frontend API Base URL

When the frontend is created, use:

```text
VITE_API_BASE_URL=http://localhost:5000/api
```

Do not put Supabase keys in frontend code.

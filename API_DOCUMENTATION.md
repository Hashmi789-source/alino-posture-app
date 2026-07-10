# Alino Posture App API Documentation

Local base URL:

```text
http://localhost:5000/api
```

`localhost` only works from the same machine running the backend. A phone, ESP32, or another computer must use the backend machine's LAN IP address or a deployed API URL.

## Authentication

Protected routes require:

```text
Authorization: Bearer <JWT_TOKEN>
```

### Register

`POST /auth/register`

```json
{
  "name": "Alino User",
  "email": "user@example.com",
  "password": "password123"
}
```

### Login

`POST /auth/login`

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Current User

`GET /auth/me`

## Devices

### Create Device

`POST /devices`

```json
{
  "deviceName": "Alino Device 01",
  "deviceUid": "ESP32_001",
  "deviceIp": "192.168.4.1"
}
```

### List Devices

`GET /devices`

### Get Device

`GET /devices/:deviceId`

### Update Device

`PATCH /devices/:deviceId`

```json
{
  "deviceName": "Alino Device 01",
  "deviceUid": "ESP32_001",
  "deviceIp": "192.168.4.1"
}
```

### Delete Device

`DELETE /devices/:deviceId`

## Calibrations

Calibration saves the user's correct posture angle as the baseline for a device.

### Create Calibration

`POST /calibrations`

```json
{
  "deviceId": "uuid-device-id",
  "baselineAngle": 8.5,
  "thresholdAngle": 12
}
```

### Get Active Calibration

`GET /calibrations/active/:deviceId`

### List Device Calibrations

`GET /calibrations/:deviceId`

## Posture Readings

Allowed `postureStatus` values:

- `good`
- `wrong`
- `unknown`

### Create Single Reading

`POST /posture-readings`

```json
{
  "deviceId": "uuid-device-id",
  "angle": 18.5,
  "postureStatus": "good",
  "recordedAt": "2026-07-08T10:40:00Z"
}
```

### Create Bulk Readings

`POST /posture-readings/bulk`

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

### Get Latest Reading

`GET /posture-readings/latest/:deviceId`

### Get Today's Readings

`GET /posture-readings/today/:deviceId`

### Query Readings

`GET /posture-readings?deviceId=uuid-device-id&from=2026-07-08T00:00:00Z&to=2026-07-09T00:00:00Z`

## Progress

`postureScore` is calculated as:

```text
goodReadings / totalReadings * 100
```

### Daily Progress

`GET /progress/daily/:deviceId?date=YYYY-MM-DD`

Example:

```text
GET /progress/daily/uuid-device-id?date=2026-07-08
```

### Monthly Progress

`GET /progress/monthly/:deviceId?month=YYYY-MM`

Example:

```text
GET /progress/monthly/uuid-device-id?month=2026-07
```

## Device Settings

Device settings are authenticated and scoped to the logged-in user's device. Only one settings record is stored per device.

Allowed `sensitivity` values:

- `low`
- `normal`
- `high`

### Create Or Replace Device Settings

`POST /device-settings`

Creates settings if missing, or updates the existing settings for the device.

```json
{
  "deviceId": "uuid-device-id",
  "sensitivity": "normal",
  "thresholdAngle": 12,
  "vibrationDelaySeconds": 60,
  "vibrationEnabled": true
}
```

### Get Device Settings

`GET /device-settings/:deviceId`

### Update Device Settings

`PATCH /device-settings/:deviceId`

```json
{
  "sensitivity": "high",
  "thresholdAngle": 10,
  "vibrationDelaySeconds": 45,
  "vibrationEnabled": true
}
```

## Device Designer Notes

- `deviceId` is the database UUID returned from the `devices` table.
- `deviceUid` is the physical ESP32 identifier, such as `ESP32_001`.
- `baselineAngle` is the calibrated correct posture angle.
- `thresholdAngle` is the allowed angle difference before posture is considered wrong.
- `angle` is the current posture angle from the BMI160 sensor.
- `recordedAt` should be an ISO 8601 timestamp.
- Keep Supabase service role keys on the backend only. The frontend and device should call this API.

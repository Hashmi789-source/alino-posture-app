# Alino Expo Mobile App

Expo + React Native + TypeScript mobile app for the Alino posture device. The app is designed for testing on a real phone with Expo Go.

## Run with Expo Go

1. `cd mobile`
2. `npm install`
3. Update `src/config/environment.ts` and replace `http://LAPTOP_WIFI_IP:5000/api` with your laptop's Wi-Fi IPv4 address, for example `http://192.168.1.25:5000/api`.
4. `npx expo start`
5. Scan the QR code using Expo Go on your phone.

## Networking notes

- The phone cannot use `localhost` to reach the laptop backend. Use your laptop Wi-Fi IPv4 address in `src/config/environment.ts`.
- The app communicates with the backend API only. It does not connect directly to Supabase and does not include Supabase service role keys or secrets.
- Device discovery is intentionally simple for users: tap **Connect Device** while the phone is connected to the Alino device Wi-Fi. The app calls `http://192.168.4.1/api/device/info` internally.

## Available scripts

- `npm run start` - start Expo.
- `npm run typecheck` - run TypeScript checks.
- `npm run build` - alias for TypeScript checks for Expo Go development.

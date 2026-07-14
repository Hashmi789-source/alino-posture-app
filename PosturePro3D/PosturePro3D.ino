#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <math.h>
#include <time.h>

#define VIBRATOR_PIN 10
#define SDA_PIN 8
#define SCL_PIN 9
// IMPORTANT: on the ESP32-C3, only GPIO0-GPIO4 have ADC capability (ADC1,
// channels 0-4). GPIO5 has none, which is what caused the
// "adc unit not supported" error. Move your battery-divider midpoint wire
// from GPIO5 to GPIO1 (a safe general-purpose ADC pin, not used for
// anything else and not a strapping pin on the C3).
#define BATTERY_PIN 1

const int MPU_ADDR = 0x68;

// The IP/host part of API_BASE_URL is now editable at runtime (saved in flash),
// so it can be provisioned over Bluetooth or the setup portal instead of being
// hard-coded here. This is only used the very first time the device boots
// with nothing saved yet.
const char *DEFAULT_API_HOST = "192.168.8.177";
const int API_PORT = 5000;
String apiHost;

const char *API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZTIzMzVlOS00MTg1LTRmZjctYjAyOC0xMDViMzQxMmQ0NjIiLCJlbWFpbCI6Im1ldGhzYWhhbkB0ZXN0LmNvbSIsImlhdCI6MTc4MzgwNTQ4NywiZXhwIjoxNzg0NDEwMjg3fQ.Ol2hYyZciigHmRbzDIfEZRnzMWqIhimkDYnyhmszu_I";
const char *DEVICE_ID = "8c7538b9-ddf4-4be2-bb57-60fa9d94bd49";
const char *DEVICE_UID = "ESP32_002";
const char *SETUP_AP_PASSWORD = "setup1234";

// --- Battery monitoring ---
// Two 10K resistors in series across the battery, midpoint on GPIO5.
// Equal resistors -> divider ratio is exactly 2 (battery voltage = 2x the
// voltage seen on the pin).
const float BATTERY_DIVIDER_RATIO = 2.0f;
// Tweak this if your measured voltage doesn't match a multimeter reading.
// To calibrate: measure the real battery voltage with a multimeter, read the
// "raw(no cal)" value this code prints to Serial, then set:
//   BATTERY_CALIBRATION_FACTOR = (multimeter voltage) / (raw(no cal) voltage)
// Calibrated from a real reading at full charge: multimeter said 3.77V while
// raw(no cal) read 3.84V, so factor = 3.77 / 3.84.
float BATTERY_CALIBRATION_FACTOR = 0.9818f;
// This pack's charger tops it out at ~3.77V rather than the usual 4.2V for a
// bare single-cell LiPo (measured with a multimeter at full charge), so use
// that as the 100% reference instead of the generic LiPo value.
const float BATTERY_FULL_VOLTAGE = 3.77f;   // ~100% (measured at full charge)
const float BATTERY_EMPTY_VOLTAGE = 3.30f;  // ~0% (safe cutoff - re-check against your charger/BMS's actual low-voltage cutoff)
const unsigned long BATTERY_SAMPLE_INTERVAL_MS = 10000;

const byte DNS_PORT = 53;
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;
WebServer portalServer(80);
WebServer apiServer(8080);
Preferences preferences;

String wifiSsid;
String wifiPassword;
String portalStatusMessage;

bool configPortalActive = false;
bool restartPending = false;
unsigned long restartAtMs = 0;
unsigned long lastTimeSyncAttemptAt = 0;

const float DEFAULT_THRESHOLD_ANGLE = 12.0f;
const unsigned long SENSOR_INTERVAL_MS = 10;
const unsigned long POST_INTERVAL_MS = 5000;
const unsigned long CALIBRATION_REFRESH_INTERVAL_MS = 60000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 15000;
const unsigned long NTP_SYNC_TIMEOUT_MS = 30000;

const unsigned long DEFAULT_TRIGGER_DELAY_MS = 5000;
const unsigned long RELEASE_DELAY = 1500;
const unsigned long VIB_ON_TIME = 300;
const unsigned long VIB_OFF_TIME = 300;
const int MAX_I2C_FAILS = 50;
const unsigned long DEVICE_SETTINGS_REFRESH_INTERVAL_MS = 30000;

float fX = 0;
float fY = 0;
float fZ = 0;

float baselineAngle = 0;
float thresholdAngle = DEFAULT_THRESHOLD_ANGLE;
float currentAngle = 0;
float currentAngleDelta = 0;

// Direction-aware tilt (front/back = pitch, left/right = roll), both zeroed
// at calibration time so "0" always means "the posture you calibrated in".
float baselinePitch = 0;
float baselineRoll = 0;
float currentPitch = 0;
float currentRoll = 0;
float deltaPitch = 0;
float deltaRoll = 0;
String bendDirection = "none"; // "none" | "forward" | "backward" | "left" | "right"

float batteryVoltage = 0;
int batteryPercent = 0;
unsigned long lastBatterySampleAt = 0;
bool directionBaselineReady = false;

BLECharacteristic *ipReportCharacteristic = nullptr;

bool isCalibrated = false;
bool isPostureBad = false;
bool vibratorState = false;
bool sensorLost = false;
bool wifiReady = false;
bool timeReady = false;
bool vibrationEnabled = true;
bool bluetoothProvisioningActive = false;

int i2cFailCount = 0;
unsigned long vibrationTimer = 0;
unsigned long triggerHoldMs = 0;
unsigned long releaseHoldMs = 0;
unsigned long lastReadingUploadAt = 0;
unsigned long lastCalibrationSyncAt = 0;
unsigned long lastWiFiRetryAt = 0;
unsigned long lastSettingsRefreshAt = 0;
unsigned long triggerDelayMs = DEFAULT_TRIGGER_DELAY_MS;

BLECharacteristic *provisionCharacteristic = nullptr;

String lastUploadedStatus = "";
float lastUploadedAngle = -9999.0f;

String htmlEscape(const String &value) {
  String escaped = value;
  escaped.replace("&", "&amp;");
  escaped.replace("<", "&lt;");
  escaped.replace(">", "&gt;");
  escaped.replace("\"", "&quot;");
  return escaped;
}

String extractJsonString(const String &payload, const char *key) {
  int keyIndex = payload.indexOf(key);
  if (keyIndex < 0) {
    return "";
  }

  keyIndex += strlen(key);
  while (keyIndex < payload.length() && (payload[keyIndex] == ' ' || payload[keyIndex] == ':')) {
    keyIndex++;
  }

  if (keyIndex >= payload.length() || payload[keyIndex] != '"') {
    return "";
  }

  keyIndex++;
  int endIndex = payload.indexOf('"', keyIndex);
  if (endIndex < 0) {
    return "";
  }

  return payload.substring(keyIndex, endIndex);
}

bool loadWiFiCredentials() {
  preferences.begin("provisioning", true);
  wifiSsid = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  apiHost = preferences.getString("apiHost", DEFAULT_API_HOST);
  preferences.end();

  wifiSsid.trim();
  wifiPassword.trim();
  apiHost.trim();
  if (apiHost.length() == 0) {
    apiHost = DEFAULT_API_HOST;
  }

  return wifiSsid.length() > 0;
}

void saveWiFiCredentials(const String &ssid, const String &password) {
  preferences.begin("provisioning", false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();

  wifiSsid = ssid;
  wifiPassword = password;
}

void saveApiHost(const String &host) {
  String trimmedHost = host;
  trimmedHost.trim();
  if (trimmedHost.length() == 0) {
    return;
  }

  preferences.begin("provisioning", false);
  preferences.putString("apiHost", trimmedHost);
  preferences.end();

  apiHost = trimmedHost;
  Serial.print("API server host updated to: ");
  Serial.println(apiHost);
}

String buildApiBaseUrl() {
  return "http://" + apiHost + ":" + String(API_PORT) + "/api";
}

void clearWiFiCredentials() {
  preferences.begin("provisioning", false);
  preferences.remove("ssid");
  preferences.remove("password");
  preferences.end();

  wifiSsid = "";
  wifiPassword = "";
}

void scheduleRestart(unsigned long delayMs) {
  restartPending = true;
  restartAtMs = millis() + delayMs;
}

String buildSetupPage(const String &message = "") {
  int scanCount = WiFi.scanNetworks();
  String networkOptions;

  for (int index = 0; index < scanCount; index++) {
    String networkName = htmlEscape(WiFi.SSID(index));
    if (networkName.length() == 0) {
      continue;
    }

    networkOptions += "<option value='" + networkName + "'>" + networkName + " (" + String(WiFi.RSSI(index)) + " dBm)</option>";
  }

  if (networkOptions.length() == 0) {
    networkOptions = "<option value=''>No networks found</option>";
  }

  String currentSsid = htmlEscape(wifiSsid.length() > 0 ? wifiSsid : "Not configured");
  String currentApiHost = htmlEscape(apiHost.length() > 0 ? apiHost : "");
  String status = htmlEscape(message.length() > 0 ? message : portalStatusMessage);

  String html;
  html.reserve(5000 + networkOptions.length() + currentSsid.length() + status.length());
  html += "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<meta name='theme-color' content='#0f172a'>";
  html += "<title>PosturePro Setup</title><style>";
  html += ":root { color-scheme: dark; --bg: #0f172a; --card: #111827; --line: #243244; --text: #e5eefc; --muted: #93a4bc; --accent: #22c55e; --accent-2: #60a5fa; }";
  html += "* { box-sizing: border-box; }";
  html += "body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: radial-gradient(circle at top, #1e293b 0, #0f172a 45%, #020617 100%); color: var(--text); min-height: 100vh; display: grid; place-items: center; padding: 20px; }";
  html += ".card { width: 100%; max-width: 520px; background: rgba(17, 24, 39, 0.92); border: 1px solid rgba(96, 165, 250, 0.18); border-radius: 24px; padding: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.35); }";
  html += ".eyebrow { text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent-2); font-size: 12px; margin-bottom: 8px; }";
  html += "h1 { margin: 0 0 8px; font-size: 30px; }";
  html += "p { margin: 0 0 18px; color: var(--muted); line-height: 1.5; }";
  html += ".status { margin-bottom: 16px; padding: 12px 14px; border-radius: 14px; background: rgba(34, 197, 94, 0.12); color: #bbf7d0; border: 1px solid rgba(34, 197, 94, 0.2); min-height: 20px; }";
  html += ".grid { display: grid; gap: 14px; }";
  html += "label { display: block; font-size: 13px; color: var(--muted); margin: 0 0 8px; }";
  html += "input, select { width: 100%; border-radius: 14px; border: 1px solid var(--line); background: #0b1220; color: var(--text); padding: 14px 14px; font-size: 16px; outline: none; }";
  html += "input:focus, select:focus { border-color: var(--accent-2); box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14); }";
  html += ".actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }";
  html += ".btn { border: 0; border-radius: 14px; padding: 14px 16px; font-size: 15px; font-weight: 700; cursor: pointer; }";
  html += ".btn-primary { background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #04111f; }";
  html += ".btn-secondary { background: #1f2937; color: var(--text); border: 1px solid var(--line); }";
  html += ".hint { margin-top: 16px; color: var(--muted); font-size: 13px; line-height: 1.5; }";
  html += "code { color: #a5b4fc; }";
  html += "</style></head><body><div class='card'><div class='eyebrow'>PosturePro 3D</div><h1>WiFi Setup</h1>";
  html += "<p>Connect the device to your home or office network. The settings are saved in flash and used on the next boot.</p>";
  html += "<div class='status'>" + status + "</div>";
  html += "<form action='/save' method='post' class='grid'><div><label for='ssid'>WiFi SSID</label>";
  html += "<input id='ssid' name='ssid' list='networks' placeholder='Select or type your WiFi name' value='" + currentSsid + "' required>";
  html += "<datalist id='networks'>" + networkOptions + "</datalist></div>";
  html += "<div><label for='password'>WiFi Password</label>";
  html += "<input id='password' name='password' type='password' placeholder='Enter WiFi password' required></div>";
  html += "<div><label for='apiHost'>App Server IP (optional)</label>";
  html += "<input id='apiHost' name='apiHost' placeholder='e.g. 172.17.93.100' value='" + currentApiHost + "'>";
  html += "</div>";
  html += "<div class='actions'><button class='btn btn-primary' type='submit'>Save and Connect</button>";
  html += "<button class='btn btn-secondary' type='button' onclick=\"location.href='/clear'\">Reset WiFi</button></div></form>";
  html += "<div class='hint'>Current setup AP: <code>PosturePro-Setup</code>. If you keep the AP password compiled in, it stays local to provisioning.</div>";
  html += "</div></body></html>";

  return html;
}

void handlePortalRoot() {
  portalServer.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  portalServer.sendHeader("Pragma", "no-cache");
  portalServer.sendHeader("Expires", "0");
  portalServer.send(200, "text/html", buildSetupPage());
}

void addCorsHeaders() {
  portalServer.sendHeader("Access-Control-Allow-Origin", "*");
  portalServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  portalServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void addApiCorsHeaders() {
  apiServer.sendHeader("Access-Control-Allow-Origin", "*");
  apiServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  apiServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleOptions() {
  addCorsHeaders();
  portalServer.send(204);
}

void handleApiOptions() {
  addApiCorsHeaders();
  apiServer.send(204);
}

void handleDeviceInfo() {
  addCorsHeaders();
  String payload = "{\"deviceUid\":\"" + String(DEVICE_UID) + "\",\"deviceName\":\"PosturePro\",\"firmwareVersion\":\"1.0.0\",\"sensorReady\":" + String(true) + ",\"calibrated\":" + String(isCalibrated ? "true" : "false") + ",\"deviceIp\":\"" + WiFi.localIP().toString() + "\",\"batteryVoltage\":" + String(batteryVoltage, 2) + ",\"batteryPercent\":" + String(batteryPercent) + ",\"angle\":" + String(currentAngleDelta, 2) + ",\"bendDirection\":\"" + bendDirection + "\"}";
  portalServer.send(200, "application/json", payload);
}

void handleApiDeviceInfo() {
  addApiCorsHeaders();
  String payload = "{\"deviceUid\":\"" + String(DEVICE_UID) + "\",\"deviceName\":\"PosturePro\",\"firmwareVersion\":\"1.0.0\",\"sensorReady\":true,\"calibrated\":" + String(isCalibrated ? "true" : "false") + ",\"deviceIp\":\"" + WiFi.localIP().toString() + "\",\"batteryVoltage\":" + String(batteryVoltage, 2) + ",\"batteryPercent\":" + String(batteryPercent) + ",\"angle\":" + String(currentAngleDelta, 2) + ",\"bendDirection\":\"" + bendDirection + "\"}";
  apiServer.send(200, "application/json", payload);
}

void handleCalibrate() {
  addCorsHeaders();
  captureLocalCalibration();
  String payload = "{\"success\":true,\"baselineAngle\":" + String(baselineAngle, 2) + ",\"thresholdAngle\":" + String(thresholdAngle, 2) + ",\"message\":\"Calibration completed successfully\"}";
  portalServer.send(200, "application/json", payload);
}

void handleApiCalibrate() {
  addApiCorsHeaders();
  captureLocalCalibration();
  String payload = "{\"success\":true,\"baselineAngle\":" + String(baselineAngle, 2) + ",\"thresholdAngle\":" + String(thresholdAngle, 2) + ",\"message\":\"Calibration completed successfully\"}";
  apiServer.send(200, "application/json", payload);
}

void handleTestMotor() {
  addCorsHeaders();
  digitalWrite(VIBRATOR_PIN, HIGH);
  delay(300);
  digitalWrite(VIBRATOR_PIN, LOW);
  portalServer.send(200, "application/json", "{\"success\":true,\"message\":\"Motor test completed\"}");
}

void handleApiTestMotor() {
  addApiCorsHeaders();
  digitalWrite(VIBRATOR_PIN, HIGH);
  delay(300);
  digitalWrite(VIBRATOR_PIN, LOW);
  apiServer.send(200, "application/json", "{\"success\":true,\"message\":\"Motor test completed\"}");
}

void handleStopMotor() {
  addCorsHeaders();
  turnVibratorOff();
  portalServer.send(200, "application/json", "{\"success\":true,\"message\":\"Motor stopped\"}");
}

void handleApiStopMotor() {
  addApiCorsHeaders();
  turnVibratorOff();
  apiServer.send(200, "application/json", "{\"success\":true,\"message\":\"Motor stopped\"}");
}

void handleProvision() {
  addCorsHeaders();
  String body = portalServer.arg("plain");
  String ssid = extractJsonString(body, "\"ssid\"");
  String password = extractJsonString(body, "\"password\"");
  String host = extractJsonString(body, "\"apiHost\"");

  ssid.trim();
  password.trim();
  host.trim();

  if (ssid.length() == 0) {
    portalServer.send(400, "application/json", "{\"success\":false,\"message\":\"SSID is required\"}");
    return;
  }

  if (host.length() > 0) {
    saveApiHost(host);
  }

  saveWiFiCredentials(ssid, password);
  portalStatusMessage = "Saved WiFi credentials. Restarting and connecting now...";
  portalServer.send(200, "application/json", "{\"success\":true,\"message\":\"Wi-Fi credentials saved\"}");
  scheduleRestart(2000);
}


void handlePortalSave() {
  String ssid = portalServer.arg("ssid");
  String password = portalServer.arg("password");
  String host = portalServer.arg("apiHost");

  ssid.trim();
  password.trim();
  host.trim();

  if (ssid.length() == 0) {
    portalServer.send(400, "text/plain", "SSID is required");
    return;
  }

  if (host.length() > 0) {
    saveApiHost(host);
  }

  saveWiFiCredentials(ssid, password);
  portalStatusMessage = "Saved WiFi credentials. Restarting and connecting now...";

  portalServer.send(200, "text/html", buildSetupPage(portalStatusMessage));
  scheduleRestart(2000);
}

void handlePortalClear() {
  clearWiFiCredentials();
  portalStatusMessage = "WiFi credentials cleared. Restarting setup portal...";

  portalServer.send(200, "text/html", buildSetupPage(portalStatusMessage));
  scheduleRestart(1500);
}

void handlePortalRedirect() {
  portalServer.sendHeader("Location", "/", true);
  portalServer.send(302, "text/plain", "");
}

void stopConfigPortal() {
  if (!configPortalActive) {
    return;
  }

  dnsServer.stop();
  portalServer.stop();
  WiFi.softAPdisconnect(true);
  configPortalActive = false;
}

void startConfigPortal(const String &message) {
  portalStatusMessage = message;

  WiFi.disconnect(true, true);
  delay(500);
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));

  String apName = String("PosturePro-") + DEVICE_UID;
  WiFi.softAP(apName.c_str(), SETUP_AP_PASSWORD);

  dnsServer.start(DNS_PORT, "*", apIP);

  portalServer.on("/", HTTP_GET, handlePortalRoot);
  portalServer.on("/save", HTTP_POST, handlePortalSave);
  portalServer.on("/clear", HTTP_GET, handlePortalClear);
  portalServer.on("/api/device/info", HTTP_GET, handleDeviceInfo);
  portalServer.on("/api/device/info", HTTP_OPTIONS, handleOptions);
  portalServer.on("/api/calibrate", HTTP_POST, handleCalibrate);
  portalServer.on("/api/calibrate", HTTP_OPTIONS, handleOptions);
  portalServer.on("/api/device/test-motor", HTTP_POST, handleTestMotor);
  portalServer.on("/api/device/test-motor", HTTP_OPTIONS, handleOptions);
  portalServer.on("/api/device/stop-motor", HTTP_POST, handleStopMotor);
  portalServer.on("/api/device/stop-motor", HTTP_OPTIONS, handleOptions);
  portalServer.on("/api/device/provision", HTTP_POST, handleProvision);
  portalServer.on("/api/device/provision", HTTP_OPTIONS, handleOptions);
  portalServer.onNotFound(handlePortalRedirect);
  portalServer.begin();

  configPortalActive = true;

  Serial.print("Config portal started at http://");
  Serial.println(WiFi.softAPIP());
}

void setupMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission(true);
}

void updateMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);

  byte error = Wire.endTransmission(false);
  if (error != 0) {
    i2cFailCount++;
    setupMPU();
    return;
  }

  uint8_t bytesReceived = Wire.requestFrom(MPU_ADDR, 6, true);
  if (bytesReceived != 6) {
    i2cFailCount++;
    setupMPU();
    return;
  }

  i2cFailCount = 0;
  sensorLost = false;

  int16_t ax = (Wire.read() << 8) | Wire.read();
  int16_t ay = (Wire.read() << 8) | Wire.read();
  int16_t az = (Wire.read() << 8) | Wire.read();

  float rawX = ax;
  float rawY = ay;
  float rawZ = az;

  float norm = sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
  if (norm > 0) {
    rawX /= norm;
    rawY /= norm;
    rawZ /= norm;
  }

  const float FILTER = 0.15f;
  fX += FILTER * (rawX - fX);
  fY += FILTER * (rawY - fY);
  fZ += FILTER * (rawZ - fZ);

  float fnorm = sqrt(fX * fX + fY * fY + fZ * fZ);
  if (fnorm > 0) {
    fX /= fnorm;
    fY /= fnorm;
    fZ /= fnorm;
  }
}

bool isPlaceholderValue(const char *value) {
  return value == nullptr || value[0] == '\0' || strstr(value, "YOUR_") == value || strstr(value, "PASTE_") == value;
}

bool backendConfigured() {
  return apiHost.length() > 0 && !isPlaceholderValue(apiHost.c_str()) && !isPlaceholderValue(API_TOKEN) &&
         !isPlaceholderValue(DEVICE_ID);
}

float currentAngleFromVector() {
  return atan2(sqrt(fX * fX + fY * fY), fZ) * 180.0f / PI;
}

// Front/back tilt (independent of left/right tilt).
float pitchFromVector() {
  return atan2(fX, fZ) * 180.0f / PI;
}

// Left/right tilt (independent of front/back tilt).
float rollFromVector() {
  return atan2(fY, fZ) * 180.0f / PI;
}

String getRecordedAtIso() {
  time_t now = time(nullptr);
  struct tm timeInfo;
  gmtime_r(&now, &timeInfo);

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  return String(buffer);
}

bool batteryPinValid = true;

void updateBatteryReading() {
  if (!batteryPinValid) {
    return;
  }

  // Average a few samples to smooth out ADC noise.
  const int sampleCount = 8;
  uint32_t totalMilliVolts = 0;

  for (int i = 0; i < sampleCount; i++) {
    int reading = analogReadMilliVolts(BATTERY_PIN);
    if (reading <= 0) {
      // GPIO has no working ADC channel (wrong pin, or driver error). Stop
      // retrying every loop so it can't stall WiFi/HTTP timing.
      batteryPinValid = false;
      batteryVoltage = 0;
      batteryPercent = 0;
      Serial.println("Battery ADC read failed - check BATTERY_PIN is a valid ADC-capable GPIO (0-4 on ESP32-C3).");
      return;
    }
    totalMilliVolts += reading;
    delay(2);
  }

  float pinMilliVolts = (float)totalMilliVolts / sampleCount;
  batteryVoltage = (pinMilliVolts / 1000.0f) * BATTERY_DIVIDER_RATIO * BATTERY_CALIBRATION_FACTOR;

  float percent = (batteryVoltage - BATTERY_EMPTY_VOLTAGE) / (BATTERY_FULL_VOLTAGE - BATTERY_EMPTY_VOLTAGE) * 100.0f;
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  batteryPercent = (int)(percent + 0.5f);

  // Handy for recalibrating: compare "reported" to a multimeter reading on
  // the battery terminals, then set BATTERY_CALIBRATION_FACTOR =
  // multimeter_voltage / reported_voltage (using the value from BEFORE this
  // calibration factor was applied, i.e. pinMilliVolts/1000 * BATTERY_DIVIDER_RATIO).
  Serial.print("Battery: pin=");
  Serial.print(pinMilliVolts, 1);
  Serial.print("mV, raw(no cal)=");
  Serial.print((pinMilliVolts / 1000.0f) * BATTERY_DIVIDER_RATIO, 2);
  Serial.print("V, reported=");
  Serial.print(batteryVoltage, 2);
  Serial.print("V, percent=");
  Serial.println(batteryPercent);
}

bool extractJsonNumber(const String &payload, const char *key, float &value) {
  int keyIndex = payload.indexOf(key);
  if (keyIndex < 0) {
    return false;
  }

  keyIndex += strlen(key);
  while (keyIndex < payload.length() && (payload[keyIndex] == ' ' || payload[keyIndex] == ':')) {
    keyIndex++;
  }

  int endIndex = keyIndex;
  while (endIndex < payload.length()) {
    char c = payload[endIndex];
    if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') {
      endIndex++;
      continue;
    }
    break;
  }

  if (endIndex == keyIndex) {
    return false;
  }

  value = payload.substring(keyIndex, endIndex).toFloat();
  return true;
}

bool httpGet(const String &path, String &responseBody, int &statusCode) {
  if (!backendConfigured()) {
    return false;
  }

  WiFiClient client;
  HTTPClient http;
  String url = buildApiBaseUrl() + path;

  if (!http.begin(client, url)) {
    return false;
  }

  http.setTimeout(15000);
  http.addHeader("Authorization", String("Bearer ") + API_TOKEN);

  statusCode = http.GET();
  responseBody = http.getString();
  http.end();

  return statusCode >= 200 && statusCode < 300;
}

bool httpPostJson(const String &path, const String &body, String &responseBody, int &statusCode) {
  if (!backendConfigured()) {
    return false;
  }

  WiFiClient client;
  HTTPClient http;
  String url = buildApiBaseUrl() + path;

  if (!http.begin(client, url)) {
    return false;
  }

  http.setTimeout(15000);
  http.addHeader("Authorization", String("Bearer ") + API_TOKEN);
  http.addHeader("Content-Type", "application/json");

  statusCode = http.POST(body);
  responseBody = http.getString();
  http.end();

  return statusCode >= 200 && statusCode < 300;
}

void turnVibratorOff() {
  // Transistor removed: the vibrator now turns ON when the pin is driven
  // HIGH, so "off" means driving the pin LOW.
  vibratorState = false;
  digitalWrite(VIBRATOR_PIN, LOW);
}

bool extractJsonBoolean(const String &payload, const char *key, bool &value) {
  int keyIndex = payload.indexOf(key);
  if (keyIndex < 0) {
    return false;
  }

  keyIndex += strlen(key);
  while (keyIndex < payload.length() && (payload[keyIndex] == ' ' || payload[keyIndex] == ':')) {
    keyIndex++;
  }

  if (payload.substring(keyIndex, keyIndex + 4) == "true") {
    value = true;
    return true;
  }

  if (payload.substring(keyIndex, keyIndex + 5) == "false") {
    value = false;
    return true;
  }

  return false;
}

bool fetchDeviceSettings() {
  if (!wifiReady) {
    return false;
  }

  String responseBody;
  int statusCode = 0;
  String path = String("/device-settings/") + DEVICE_ID;

  if (!httpGet(path, responseBody, statusCode)) {
    return false;
  }

  float fetchedDelaySeconds = 5.0f;
  bool fetchedVibrationEnabled = true;
  float fetchedThresholdAngle = thresholdAngle;

  if (!extractJsonNumber(responseBody, "\"vibrationDelaySeconds\":", fetchedDelaySeconds)) {
    fetchedDelaySeconds = 5.0f;
  }

  if (!extractJsonBoolean(responseBody, "\"vibrationEnabled\":", fetchedVibrationEnabled)) {
    fetchedVibrationEnabled = true;
  }

  // Device settings' thresholdAngle is the one the Settings page in the app
  // actually edits. Apply it here so it takes effect (previously the
  // firmware only ever looked at the calibration's threshold, so this
  // field in the app had no effect on the device at all).
  extractJsonNumber(responseBody, "\"thresholdAngle\":", fetchedThresholdAngle);

  triggerDelayMs = max(1000ul, (unsigned long)max(1.0f, fetchedDelaySeconds) * 1000ul);
  vibrationEnabled = fetchedVibrationEnabled;
  thresholdAngle = fetchedThresholdAngle;
  return true;
}

void pushCalibrationToBackend() {
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"baselineAngle\":" + String(baselineAngle, 2) + ",";
  body += "\"thresholdAngle\":" + String(thresholdAngle, 2);
  body += "}";

  String responseBody;
  int statusCode = 0;
  if (!httpPostJson("/calibrations", body, responseBody, statusCode)) {
    Serial.print("Calibration upload failed: ");
    Serial.println(statusCode);
    Serial.println(responseBody);
    return;
  }

  Serial.println("Calibration synced to backend");
}

bool fetchActiveCalibration() {
  String responseBody;
  int statusCode = 0;
  String path = String("/calibrations/active/") + DEVICE_ID;

  if (!httpGet(path, responseBody, statusCode)) {
    Serial.print("Calibration fetch failed: ");
    Serial.println(statusCode);
    Serial.println(responseBody);
    return false;
  }

  float fetchedBaseline = 0;
  float fetchedThreshold = DEFAULT_THRESHOLD_ANGLE;

  if (!extractJsonNumber(responseBody, "\"baselineAngle\":", fetchedBaseline)) {
    return false;
  }

  if (!extractJsonNumber(responseBody, "\"thresholdAngle\":", fetchedThreshold)) {
    fetchedThreshold = DEFAULT_THRESHOLD_ANGLE;
  }

  baselineAngle = fetchedBaseline;
  thresholdAngle = fetchedThreshold;
  isCalibrated = true;

  // The backend only stores the single overall baseline angle, not the
  // separate pitch/roll baselines used for left/right/front/back detection.
  // Only seed those once per boot (not on every periodic 60s refresh, or
  // we'd keep re-zeroing the direction baseline to whatever posture the
  // person happens to be in at that moment).
  if (!directionBaselineReady) {
    updateMPU();
    baselinePitch = pitchFromVector();
    baselineRoll = rollFromVector();
    directionBaselineReady = true;
  }

  Serial.print("Calibration loaded. Baseline: ");
  Serial.print(baselineAngle, 2);
  Serial.print(", Threshold: ");
  Serial.println(thresholdAngle, 2);

  return true;
}

void captureLocalCalibration() {
  Serial.println("Capturing local calibration baseline...");

  const int sampleCount = 100;
  float sum = 0;
  float pitchSum = 0;
  float rollSum = 0;

  for (int i = 0; i < sampleCount; i++) {
    updateMPU();
    sum += currentAngleFromVector();
    pitchSum += pitchFromVector();
    rollSum += rollFromVector();
    delay(50);
  }

  baselineAngle = sum / sampleCount;
  baselinePitch = pitchSum / sampleCount;
  baselineRoll = rollSum / sampleCount;
  directionBaselineReady = true;
  thresholdAngle = DEFAULT_THRESHOLD_ANGLE;
  isCalibrated = true;
  isPostureBad = false;
  triggerHoldMs = 0;
  releaseHoldMs = 0;
  vibrationTimer = millis();
  currentAngleDelta = 0;
  deltaPitch = 0;
  deltaRoll = 0;
  bendDirection = "none";
  lastUploadedStatus = "";
  lastUploadedAngle = -9999.0f;

  Serial.print("Local baseline captured: ");
  Serial.println(baselineAngle, 2);

  pushCalibrationToBackend();
}

void updatePostureState(float measuredAngle) {
  currentAngle = measuredAngle;

  if (!isCalibrated) {
    currentAngleDelta = 0;
    deltaPitch = 0;
    deltaRoll = 0;
    bendDirection = "none";
    isPostureBad = false;
    triggerHoldMs = 0;
    releaseHoldMs = 0;
    turnVibratorOff();
    return;
  }

  currentAngleDelta = fabs(currentAngle - baselineAngle);

  currentPitch = pitchFromVector();
  currentRoll = rollFromVector();
  deltaPitch = currentPitch - baselinePitch;
  deltaRoll = currentRoll - baselineRoll;

  float triggerAngle = thresholdAngle;
  float releaseAngle = thresholdAngle > 3.0f ? thresholdAngle - 3.0f : thresholdAngle;

  if (!isPostureBad) {
    if (currentAngleDelta >= triggerAngle) {
      triggerHoldMs += SENSOR_INTERVAL_MS;
    } else {
      // triggerHoldMs is unsigned, so subtracting past 0 wraps around to a
      // huge number instead of going negative - checking "< 0" afterward
      // never catches it. Check the size BEFORE subtracting instead. This
      // was the actual cause of posture reading as "bad" immediately after
      // calibrating: with triggerHoldMs already at 0, the old code
      // underflowed on the very first good-posture tick, which then looked
      // like it had already exceeded the vibration delay.
      if (triggerHoldMs > SENSOR_INTERVAL_MS * 2) {
        triggerHoldMs -= SENSOR_INTERVAL_MS * 2;
      } else {
        triggerHoldMs = 0;
      }
    }

    if (triggerHoldMs >= triggerDelayMs) {
      isPostureBad = true;
      triggerHoldMs = 0;
      releaseHoldMs = 0;
      vibrationTimer = millis();
      vibratorState = true;
      if (vibrationEnabled) {
        digitalWrite(VIBRATOR_PIN, HIGH);
      } else {
        turnVibratorOff();
      }
    }
  } else {
    if (currentAngleDelta <= releaseAngle) {
      releaseHoldMs += SENSOR_INTERVAL_MS;
    } else {
      // Same underflow fix as triggerHoldMs above.
      if (releaseHoldMs > SENSOR_INTERVAL_MS * 2) {
        releaseHoldMs -= SENSOR_INTERVAL_MS * 2;
      } else {
        releaseHoldMs = 0;
      }
    }

    if (releaseHoldMs >= RELEASE_DELAY) {
      isPostureBad = false;
      releaseHoldMs = 0;
      triggerHoldMs = 0;
      turnVibratorOff();
    }
  }

  // Bend direction reporting disabled per request - its baseline (pitch/roll)
  // was only ever seeded from whatever position the sensor happened to be in
  // at the first calibration fetch after boot, not from the actual
  // calibration posture, which made the forward/backward/left/right label
  // unreliable. Always report "none"; the app already falls back to showing
  // "Good" whenever bendDirection is "none".
  bendDirection = "none";

  if (isPostureBad) {
    if (!vibrationEnabled) {
      turnVibratorOff();
      return;
    }

    unsigned long currentVibTime = millis() - vibrationTimer;

    if (vibratorState) {
      if (currentVibTime >= VIB_ON_TIME) {
        vibratorState = false;
        digitalWrite(VIBRATOR_PIN, LOW);
        vibrationTimer = millis();
      }
    } else {
      if (currentVibTime >= VIB_OFF_TIME) {
        vibratorState = true;
        digitalWrite(VIBRATOR_PIN, HIGH);
        vibrationTimer = millis();
      }
    }
  } else {
    turnVibratorOff();
  }
}

void uploadPostureReading() {
  String postureStatus = !isCalibrated ? "unknown" : (isPostureBad ? "wrong" : "good");

  if ((millis() - lastReadingUploadAt) < POST_INTERVAL_MS) {
    return;
  }

  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"angle\":" + String(currentAngleDelta, 2) + ",";
  body += "\"postureStatus\":\"" + postureStatus + "\",";
  body += "\"bendDirection\":\"" + bendDirection + "\",";
  body += "\"batteryVoltage\":" + String(batteryVoltage, 2) + ",";
  body += "\"batteryPercent\":" + String(batteryPercent) + ",";
  body += "\"recordedAt\":\"" + getRecordedAtIso() + "\"";
  body += "}";

  String responseBody;
  int statusCode = 0;
  if (!httpPostJson("/posture-readings", body, responseBody, statusCode)) {
    Serial.print("Posture upload failed: ");
    Serial.println(statusCode);
    Serial.println(responseBody);
    return;
  }

  lastReadingUploadAt = millis();
  lastUploadedStatus = postureStatus;
  lastUploadedAngle = currentAngle;
}

void connectWiFi() {
  wifiReady = false;

  if (wifiSsid.length() == 0) {
    Serial.println("No saved WiFi credentials found");
    startConfigPortal("Enter WiFi SSID and password below.");
    return;
  }

  if (configPortalActive) {
    stopConfigPortal();
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());

  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  wifiReady = WiFi.status() == WL_CONNECTED;
  if (wifiReady) {
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
    if (ipReportCharacteristic != nullptr) {
      ipReportCharacteristic->setValue(WiFi.localIP().toString().c_str());
    }
    if (configPortalActive) {
      stopConfigPortal();
    }
    apiServer.on("/api/device/info", HTTP_GET, handleApiDeviceInfo);
    apiServer.on("/api/device/info", HTTP_OPTIONS, handleApiOptions);
    apiServer.on("/api/calibrate", HTTP_POST, handleApiCalibrate);
    apiServer.on("/api/calibrate", HTTP_OPTIONS, handleApiOptions);
    apiServer.on("/api/device/test-motor", HTTP_POST, handleApiTestMotor);
    apiServer.on("/api/device/test-motor", HTTP_OPTIONS, handleApiOptions);
    apiServer.on("/api/device/stop-motor", HTTP_POST, handleApiStopMotor);
    apiServer.on("/api/device/stop-motor", HTTP_OPTIONS, handleApiOptions);
    apiServer.begin();
    Serial.println("API server started on port 8080");
  } else {
    Serial.println("WiFi connection timed out");
    startConfigPortal("Saved WiFi could not connect. Enter new credentials.");
  }
}

void syncTime() {
  if (!wifiReady) {
    timeReady = false;
    return;
  }

  setenv("TZ", "UTC0", 1);
  tzset();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  unsigned long start = millis();
  time_t now = time(nullptr);
  while (now < 1700000000 && (millis() - start) < NTP_SYNC_TIMEOUT_MS) {
    delay(500);
    now = time(nullptr);
  }

  timeReady = now >= 1700000000;
  if (timeReady) {
    Serial.println("Time synchronized");
  } else {
    Serial.println("Time sync timed out");
  }
}

void ensureBackendCalibration() {
  if (!wifiReady) {
    return;
  }

  if (!fetchActiveCalibration()) {
    captureLocalCalibration();
  }
}

class ProvisionCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    // Newer arduino-esp32 BLE cores return a String from getValue();
    // older cores return a std::string. Building the String from
    // whatever we get keeps this compiling on either core version.
    String payload = String(characteristic->getValue().c_str());
    String ssid = extractJsonString(payload, "\"ssid\"");
    String password = extractJsonString(payload, "\"password\"");
    String host = extractJsonString(payload, "\"apiHost\"");
    ssid.trim();
    password.trim();
    host.trim();

    bool changedSomething = false;

    if (host.length() > 0) {
      saveApiHost(host);
      changedSomething = true;
    }

    if (ssid.length() > 0) {
      saveWiFiCredentials(ssid, password);
      portalStatusMessage = "Saved WiFi credentials over Bluetooth.";
      bluetoothProvisioningActive = true;
      changedSomething = true;
      // Only a WiFi credential change needs a restart; an API host change
      // alone can be applied live since it doesn't affect the WiFi radio.
      scheduleRestart(1500);
    }

    if (changedSomething && ipReportCharacteristic != nullptr) {
      ipReportCharacteristic->setValue("pending");
    }
  }
};

void initBluetoothProvisioning() {
  BLEDevice::init(String("PosturePro-") + DEVICE_UID);
  BLEServer *server = BLEDevice::createServer();
  BLEService *service = server->createService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
  provisionCharacteristic = service->createCharacteristic(
    "beb5483e-36e7-4688-bc5e-8f4f4f4f4f4f",
    BLECharacteristic::PROPERTY_WRITE);

  provisionCharacteristic->setCallbacks(new ProvisionCharacteristicCallbacks());

  // Read-only characteristic the web app can read after provisioning so the
  // person never has to type the device's IP address in by hand.
  ipReportCharacteristic = service->createCharacteristic(
    "0d6a1b2e-7f0e-4a2a-9f0a-6b0f7e9c2a10",
    BLECharacteristic::PROPERTY_READ);
  ipReportCharacteristic->setValue("unknown");

  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
}

void setup() {
  Serial.begin(115200);

  pinMode(VIBRATOR_PIN, OUTPUT);
  turnVibratorOff();
  delay(10);

  analogSetPinAttenuation(BATTERY_PIN, ADC_11db);
  updateBatteryReading();
  lastBatterySampleAt = millis();

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  setupMPU();

  initBluetoothProvisioning();
  loadWiFiCredentials();
  connectWiFi();
  if (wifiReady) {
    syncTime();
    ensureBackendCalibration();
    fetchDeviceSettings();
  }

  for (int i = 0; i < 10; i++) {
    updateMPU();
    delay(10);
  }

  Serial.println("Posture device ready");
  Serial.print("Device UID: ");
  Serial.println(DEVICE_UID);
}

void loop() {
  if (configPortalActive) {
    dnsServer.processNextRequest();
    portalServer.handleClient();

    if (restartPending && millis() >= restartAtMs) {
      ESP.restart();
    }
  }

  if (wifiReady) {
    apiServer.handleClient();
  }

  if (!configPortalActive && WiFi.status() != WL_CONNECTED && (millis() - lastWiFiRetryAt) >= WIFI_RETRY_INTERVAL_MS) {
    lastWiFiRetryAt = millis();
    connectWiFi();
    if (wifiReady && !isCalibrated) {
      ensureBackendCalibration();
    }
  }

  if (wifiReady && !timeReady && (millis() - lastTimeSyncAttemptAt) >= 60000) {
    lastTimeSyncAttemptAt = millis();
    syncTime();
  }

  updateMPU();

  if ((millis() - lastBatterySampleAt) >= BATTERY_SAMPLE_INTERVAL_MS) {
    lastBatterySampleAt = millis();
    updateBatteryReading();
  }

  if (i2cFailCount > MAX_I2C_FAILS) {
    sensorLost = true;
  }

  if (sensorLost) {
    isPostureBad = false;
    triggerHoldMs = 0;
    releaseHoldMs = 0;
    turnVibratorOff();
    delay(SENSOR_INTERVAL_MS);
    return;
  }

  float measuredAngle = currentAngleFromVector();
  updatePostureState(measuredAngle);

  if (wifiReady && !timeReady && (millis() - lastSettingsRefreshAt) >= DEVICE_SETTINGS_REFRESH_INTERVAL_MS) {
    lastSettingsRefreshAt = millis();
    fetchDeviceSettings();
  }

  if (wifiReady && timeReady) {
    // Only pull calibration from the backend on this timer if we don't
    // already have a good local calibration. Calibrating from the app hits
    // this device directly and takes effect immediately, so periodically
    // re-fetching "the active calibration" after that point served no
    // purpose - it could only ever overwrite a fresh, correct baseline with
    // a stale one (e.g. if the post-calibration push to the backend lagged
    // behind this refresh timer), which is what was causing good posture to
    // suddenly read as bad ~60s after calibrating.
    if (!isCalibrated && (millis() - lastCalibrationSyncAt) >= CALIBRATION_REFRESH_INTERVAL_MS) {
      lastCalibrationSyncAt = millis();
      fetchActiveCalibration();
    }

    if ((millis() - lastSettingsRefreshAt) >= DEVICE_SETTINGS_REFRESH_INTERVAL_MS) {
      lastSettingsRefreshAt = millis();
      fetchDeviceSettings();
    }

    uploadPostureReading();
  }

  delay(SENSOR_INTERVAL_MS);
}
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bluetooth,
  CalendarDays,
  CheckCircle2,
  Gauge,
  HelpCircle,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Menu,
  Plus,
  Radio,
  Settings,
  Smartphone,
  Target,
  User,
  Vibrate,
  Wifi,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  alinoDevice,
  api,
  setAlinoDeviceUrl,
  AlinoDeviceInfo,
  ApiUser,
  Calibration,
  Device,
  DeviceSettings,
  PostureReading,
  PostureStatus,
  ProgressSummary,
  tokenStore,
} from "./api/apiClient";

const ACTIVE_DEVICE_KEY = "alino_active_device_id";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(element: HTMLElement, options: Record<string, string | number>): void;
        };
      };
    };
  }
}

type AppNotice = {
  type: "success" | "error" | "info";
  message: string;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

const numberValue = (value: FormDataEntryValue | null) => Number(value || 0);
const textValue = (value: FormDataEntryValue | null) => String(value || "").trim();

function useNotice() {
  const [notice, setNotice] = useState<AppNotice | null>(null);

  const run = async (action: () => Promise<void>, successMessage?: string) => {
    try {
      await action();
      if (successMessage) {
        setNotice({ type: "success", message: successMessage });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  };

  return { notice, setNotice, run };
}

function Notice({ notice }: { notice: AppNotice | null }) {
  if (!notice) {
    return null;
  }

  return <div className={`notice ${notice.type}`}>{notice.message}</div>;
}

function GoogleSignInButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    const render = () => {
      if (!window.google || !containerRef.current) return;
      containerRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => onCredential(credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 320,
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render, { once: true });
      return () => existing.removeEventListener("load", render);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", render, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", render);
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div className="google-button" ref={containerRef} />;
}

function BrandLogo({ className = "" }: { className?: string }) {
  return <img className={`brand-logo ${className}`} src="/assets/alino-logo.png" alt="Alino" />;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Radio size={22} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   AUTH SCREEN — matches original teal design
   ══════════════════════════════════════════════════ */
function AuthScreen({
  mode,
  onAuth,
}: {
  mode: "login" | "register";
  onAuth: (user: ApiUser, token: string) => void;
}) {
  const navigate = useNavigate();
  const { notice, run } = useNotice();
  const isRegister = mode === "register";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    run(async () => {
      const result = isRegister
        ? await api.auth.register({
            name: textValue(form.get("name")),
            email: textValue(form.get("email")),
            password: String(form.get("password") || ""),
          })
        : await api.auth.login({
            email: textValue(form.get("email")),
            password: String(form.get("password") || ""),
          });

      onAuth(result.user, result.token);
      navigate("/dashboard");
    });
  };

  const handleGoogleCredential = (credential: string) => {
    run(async () => {
      const result = await api.auth.google(credential);
      onAuth(result.user, result.token);
      navigate("/dashboard");
    });
  };

  return (
    <main className="auth-page">
      {/* Brand header */}
      <div className="auth-brand">
        <BrandLogo className="auth-logo" />
        <p>Precision posture & wellness</p>
      </div>

      {/* Auth card */}
      <section className="auth-card">
        <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p className="subtitle">
          {isRegister ? "Sign up to start tracking your posture." : "Enter your details to sign in."}
        </p>

        <Notice notice={notice} />

        <form
          key={mode}
          className="form-stack"
          autoComplete={isRegister ? "off" : "on"}
          onSubmit={handleSubmit}
        >
          {isRegister && (
            <div className="field-group">
              <div className="field-label">
                <label>NAME</label>
              </div>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  name="name"
                  type="text"
                  placeholder="Your full name"
                  autoComplete="off"
                  defaultValue=""
                  minLength={2}
                  required
                />
              </div>
            </div>
          )}

          <div className="field-group">
            <div className="field-label">
              <label>EMAIL</label>
            </div>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete={isRegister ? "off" : "email"}
                defaultValue=""
                required
              />
            </div>
          </div>

          <div className="field-group">
            <div className="field-label">
              <label>PASSWORD</label>
              {isRegister && <span className="field-hint">8+ characters</span>}
            </div>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                defaultValue=""
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
          </div>

          <button className="btn-primary" type="submit">
            {isRegister ? "Create account" : "Login"}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <GoogleSignInButton onCredential={handleGoogleCredential} />
          </>
        )}

        <p className="auth-switch">
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <Link to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Login" : "Sign Up"}
          </Link>
        </p>

      </section>
    </main>
  );
}

/* ══════════════════════════════════════════════════
   PROTECTED LAYOUT — mobile bottom tabs
   ══════════════════════════════════════════════════ */
function ProtectedLayout({
  user,
  devices,
  activeDeviceId,
  onSelectDevice,
  onLogout,
  children,
}: {
  user: ApiUser;
  devices: Device[];
  activeDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const location = useLocation();

  const tabs = [
    { path: "/dashboard", label: "Home", icon: Gauge },
    { path: "/devices", label: "Devices", icon: Smartphone },
    { path: "/live", label: "Live", icon: Activity },
    { path: "/progress/daily", label: "Progress", icon: BarChart3 },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/progress/daily") {
      return location.pathname.startsWith("/progress");
    }
    return location.pathname === path;
  };

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-left">
          <Link className="topbar-brand" to="/dashboard">
            <BrandLogo className="topbar-logo" />
          </Link>
        </div>
        <div className="topbar-right">
          <select
            className="topbar-device-select"
            value={activeDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
          >
            <option value="">Select device</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.deviceName}
              </option>
            ))}
          </select>
          <button className="btn-icon" type="button" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="content">{children}</main>

      {/* Bottom navigation */}
      <nav className="bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`tab-link ${isActive(tab.path) ? "active" : ""}`}
            >
              <Icon size={22} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════ */
function Dashboard({
  devices,
  activeDevice,
  latestReading,
  progressSummary,
}: {
  devices: Device[];
  activeDevice?: Device;
  latestReading: PostureReading | null;
  progressSummary: ProgressSummary | null;
}) {

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Home</p>
        <h1>Posture Overview</h1>
      </div>

      {/* Metric cards */}
      <div className="metric-row">
        <MetricCard label="Devices" value={String(devices.length)} accent="teal" />
        <MetricCard label="Latest Angle" value={latestReading ? `${latestReading.angle}°` : "—"} accent="gray" />
        <MetricCard
          label="Today Score"
          value={progressSummary ? `${progressSummary.postureScore ?? 0}%` : "—"}
          accent={progressSummary && (progressSummary.postureScore ?? 0) >= 70 ? "green" : "orange"}
        />
        <MetricCard
          label="Readings"
          value={progressSummary ? String(progressSummary.totalReadings) : "—"}
          accent="teal"
        />
      </div>

      {activeDevice ? (
        <>
          {/* Posture status */}
          <div className="card">
            <h3>Current Posture</h3>
            {latestReading ? (
              <PostureStatusDisplay reading={latestReading} />
            ) : (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                No reading has been saved yet.
              </p>
            )}
          </div>

          {/* Active device info */}
          <div className="card">
            <h3>Active Device</h3>
            <dl className="details-list">
              <div className="details-row">
                <dt>Name</dt>
                <dd>{activeDevice.deviceName}</dd>
              </div>
              <div className="details-row">
                <dt>Device UID</dt>
                <dd>{activeDevice.deviceUid}</dd>
              </div>
              <div className="details-row">
                <dt>Device IP</dt>
                <dd>{activeDevice.deviceIp}</dd>
              </div>
            </dl>
          </div>
        </>
      ) : (
        <EmptyState
          title="Register a device first"
          body="Add your ESP32 device to unlock calibration and progress views."
        />
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "teal" | "green" | "orange" | "gray";
}) {
  return (
    <div className={`metric-card accent-${accent}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  );
}

function PostureStatusDisplay({ reading }: { reading: PostureReading }) {
  return (
    <div className="posture-status">
      <div className={`status-circle ${reading.postureStatus}`}>
        <span className="angle-value">{reading.angle}</span>
        <span className="angle-unit">deg</span>
      </div>
      <p className={`posture-label ${reading.postureStatus}`}>{reading.postureStatus} Posture</p>
      <p className="posture-time">{new Date(reading.recordedAt).toLocaleString()}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   DEVICE SETUP
   ══════════════════════════════════════════════════ */
function DeviceSetup({
  devices,
  activeDeviceId,
  onRefresh,
  onSelectDevice,
}: {
  devices: Device[];
  activeDeviceId: string;
  onRefresh: () => Promise<void>;
  onSelectDevice: (deviceId: string) => void;
}) {
  const { notice, setNotice } = useNotice();
  const [connecting, setConnecting] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [motorTesting, setMotorTesting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [apiHost, setApiHost] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [detectingIp, setDetectingIp] = useState(false);

  const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
  const PROVISION_CHAR_UUID = "beb5483e-36e7-4688-bc5e-8f4f4f4f4f4f";
  const IP_CHAR_UUID = "0d6a1b2e-7f0e-4a2a-9f0a-6b0f7e9c2a10";

  const getBluetoothApi = () => {
    const bluetoothApi = navigator as Navigator & {
      bluetooth?: {
        requestDevice(options: {
          filters?: Array<{ namePrefix?: string }>;
          optionalServices?: string[];
        }): Promise<any>;
      };
    };
    return bluetoothApi.bluetooth;
  };

  // Reads the device's current IP straight over Bluetooth - no manual typing.
  // Works any time the device is already on Wi-Fi (not just right after
  // provisioning), so it doubles as a "find my device" button later too.
  const handleDetectIp = async () => {
    const bluetooth = getBluetoothApi();
    if (!bluetooth) {
      setNotice({ type: "error", message: "Web Bluetooth is not supported in this browser." });
      return;
    }

    setDetectingIp(true);
    setNotice({ type: "info", message: "Looking for your Alino device over Bluetooth..." });

    try {
      const device = await bluetooth.requestDevice({
        filters: [{ namePrefix: "PosturePro-" }],
        optionalServices: [SERVICE_UUID],
      });
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("Bluetooth GATT server was not available.");
      }

      const service = await server.getPrimaryService(SERVICE_UUID);
      const ipCharacteristic = await service.getCharacteristic(IP_CHAR_UUID);
      const value = await ipCharacteristic.readValue();
      const ipText = new TextDecoder().decode(value).trim();

      if (/^\d+\.\d+\.\d+\.\d+$/.test(ipText)) {
        setDeviceIp(ipText);
        setNotice({ type: "success", message: `Found your Alino at ${ipText}. Tap Connect Device to finish.` });
      } else {
        setNotice({
          type: "error",
          message: "Your Alino hasn't connected to Wi-Fi yet. Pair it below first, then try again.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to reach your Alino device over Bluetooth.",
      });
    } finally {
      setDetectingIp(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setNotice({ type: "info", message: "Looking for your Alino device..." });

    try {
      setAlinoDeviceUrl(deviceIp);
      const deviceInfo = await alinoDevice.info();
      if (!deviceInfo.sensorReady) {
        throw new Error("Your Alino sensor is not ready. Restart the device and try again.");
      }

      const result = await api.devices.create({
        deviceName: deviceInfo.deviceName,
        deviceUid: deviceInfo.deviceUid,
        deviceIp: deviceIp,
      });
      await onRefresh();
      onSelectDevice(result.device.id);
      setNotice({ type: "success", message: "Alino device connected successfully" });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to connect your Alino device. Please try again.",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handlePairViaBluetooth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bluetooth = getBluetoothApi();

    if (!bluetooth) {
      setNotice({ type: "error", message: "Web Bluetooth is not supported in this browser." });
      return;
    }

    setPairing(true);
    setNotice({ type: "info", message: "Searching for your Alino device over Bluetooth..." });

    try {
      const device = await bluetooth.requestDevice({
        filters: [{ namePrefix: "PosturePro-" }],
        optionalServices: [SERVICE_UUID],
      });
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("Bluetooth GATT server was not available.");
      }

      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(PROVISION_CHAR_UUID);
      const payload = JSON.stringify(apiHost.trim() ? { ssid, password, apiHost: apiHost.trim() } : { ssid, password });
      await characteristic.writeValue(new TextEncoder().encode(payload));

      setNotice({
        type: "info",
        message: "Credentials sent. Waiting for the device to reconnect to Wi-Fi so we can fetch its IP address...",
      });

      // The device restarts to apply new Wi-Fi credentials, which drops this
      // BLE connection. Reconnect (no new picker needed, permission is
      // already granted) and poll the IP characteristic until it reports a
      // real address, so the person never has to type it in manually.
      let fetchedIp = "";
      for (let attempt = 0; attempt < 20 && !fetchedIp; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const reconnectedServer = device.gatt?.connected ? device.gatt : await device.gatt?.connect();
          if (!reconnectedServer) continue;
          const reconnectedService = await reconnectedServer.getPrimaryService(SERVICE_UUID);
          const ipCharacteristic = await reconnectedService.getCharacteristic(IP_CHAR_UUID);
          const value = await ipCharacteristic.readValue();
          const ipText = new TextDecoder().decode(value).trim();
          if (/^\d+\.\d+\.\d+\.\d+$/.test(ipText)) {
            fetchedIp = ipText;
          }
        } catch {
          // Device is mid-restart or briefly unreachable; keep retrying.
        }
      }

      if (fetchedIp) {
        setDeviceIp(fetchedIp);
        setNotice({
          type: "success",
          message: `Wi-Fi credentials saved. Found your Alino at ${fetchedIp} — tap Connect Device to finish registering it.`,
        });
      } else {
        setNotice({
          type: "success",
          message: "Wi-Fi credentials were sent over Bluetooth. Enter the device IP manually once it reconnects.",
        });
      }

      setSsid("");
      setPassword("");
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to pair your Alino device over Bluetooth.",
      });
    } finally {
      setPairing(false);
    }
  };

  const handleTestMotor = async () => {
    setMotorTesting(true);
    setNotice({ type: "info", message: "Testing the vibration motor..." });

    try {
      const result = await alinoDevice.testMotor();
      setNotice({ type: result.success ? "success" : "error", message: result.message });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to trigger the motor.",
      });
    } finally {
      setMotorTesting(false);
    }
  };

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Devices</p>
        <h1>Connect Your Alino</h1>
      </div>

      <Notice notice={notice} />

      <div className="card connect-card">
        <div className="connect-icon"><Wifi size={28} /></div>
        <h3>Connect Device</h3>
        <p>
          {deviceIp
            ? `Found your Alino at ${deviceIp}. Tap Connect Device to finish.`
            : "Tap \"Find via Bluetooth\" to locate your Alino automatically - no need to type its IP address."}
        </p>
        <div className="inline-form" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-secondary" type="button" onClick={handleDetectIp} disabled={detectingIp}>
            {detectingIp ? <LoaderCircle className="spin" size={18} /> : <Bluetooth size={18} />}
            {detectingIp ? "Searching..." : "Find via Bluetooth"}
          </button>
          <button className="btn-primary" type="button" onClick={handleConnect} disabled={connecting || !deviceIp}>
            {connecting ? <LoaderCircle className="spin" size={18} /> : <Smartphone size={18} />}
            {connecting ? "Connecting..." : "Connect Device"}
          </button>
          <button className="btn-secondary" type="button" onClick={handleTestMotor} disabled={motorTesting}>
            {motorTesting ? <LoaderCircle className="spin" size={18} /> : <Vibrate size={18} />}
            {motorTesting ? "Testing..." : "Test motor"}
          </button>
          <Link to="/calibration" className="btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Target size={18} />
            Calibrate / Recalibrate
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="connect-icon"><Bluetooth size={24} /></div>
        <h3>Bluetooth Pairing</h3>
        <p>Pair your Alino over Bluetooth on first boot so you can enter the Wi-Fi details without opening the setup page.</p>
        <form className="form-grid" onSubmit={handlePairViaBluetooth} autoComplete="off">
          <label className="simple-label">
            Wi-Fi SSID
            <input
              className="simple-input"
              name="wifiSsid"
              autoComplete="off"
              value={ssid}
              onChange={(event) => setSsid(event.target.value)}
              required
            />
          </label>
          <label className="simple-label">
            Wi-Fi Password
            <input
              className="simple-input"
              name="wifiPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="simple-label">
            App Server IP (optional)
            <input
              className="simple-input"
              name="apiHost"
              autoComplete="off"
              placeholder="e.g. 172.17.93.100"
              value={apiHost}
              onChange={(event) => setApiHost(event.target.value)}
            />
          </label>
          <button className="btn-primary" type="submit" disabled={pairing}>
            {pairing ? <LoaderCircle className="spin" size={18} /> : <Bluetooth size={18} />}
            {pairing ? "Pairing..." : "Pair via Bluetooth"}
          </button>
        </form>
      </div>

      {/* Device list */}
      <div className="card">
        <h3>Your Devices</h3>
        <div className="device-list">
          {devices.map((device) => (
            <div
              className={`device-row ${device.id === activeDeviceId ? "selected" : ""}`}
              key={device.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <button
                type="button"
                onClick={() => onSelectDevice(device.id)}
                style={{ background: "none", border: 0, flex: 1, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span className="device-info">
                  <span className="device-name">{device.deviceName}</span>
                  <span className="device-friendly-status">
                    {device.id === activeDeviceId ? "Connected and selected" : "Tap to select"}
                    {device.deviceIp ? ` · ${device.deviceIp}` : ""}
                  </span>
                </span>
                {device.id === activeDeviceId && <CheckCircle2 size={20} />}
              </button>
              <button
                className="btn-icon"
                type="button"
                title="Remove device"
                disabled={removingId === device.id}
                onClick={async () => {
                  if (!window.confirm(`Remove "${device.deviceName}" from your account?`)) {
                    return;
                  }
                  setRemovingId(device.id);
                  try {
                    await api.devices.remove(device.id);
                    if (device.id === activeDeviceId) {
                      onSelectDevice("");
                    }
                    await onRefresh();
                    setNotice({ type: "success", message: `${device.deviceName} was removed.` });
                  } catch (error) {
                    setNotice({
                      type: "error",
                      message: error instanceof Error ? error.message : "Unable to remove device.",
                    });
                  } finally {
                    setRemovingId(null);
                  }
                }}
              >
                {removingId === device.id ? <LoaderCircle className="spin" size={16} /> : "Remove"}
              </button>
            </div>
          ))}
          {devices.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No devices registered yet.</p>}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════
   CALIBRATION
   ══════════════════════════════════════════════════ */
function CalibrationScreen({ activeDevice }: { activeDevice?: Device }) {
  const { notice, setNotice } = useNotice();
  const [activeCalibration, setActiveCalibration] = useState<Calibration | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const loadActiveCalibration = async () => {
    if (!activeDevice) {
      return;
    }

    try {
      const result = await api.calibrations.active(activeDevice.id);
      setActiveCalibration(result.calibration);
    } catch {
      setActiveCalibration(null);
    }
  };

  useEffect(() => {
    loadActiveCalibration();
  }, [activeDevice?.id]);

  const handleCalibrate = async () => {
    if (!activeDevice || calibrating) return;
    setCalibrating(true);
    setNotice({ type: "info", message: "Calibrating..." });

    try {
      const deviceCalibration = await alinoDevice.calibrate();
      if (!deviceCalibration.success) throw new Error(deviceCalibration.message);

      const result = await api.calibrations.create({
        deviceId: activeDevice.id,
        baselineAngle: deviceCalibration.baselineAngle,
        thresholdAngle: deviceCalibration.thresholdAngle,
      });
      setActiveCalibration(result.calibration);
      setNotice({ type: "success", message: "Calibration completed successfully" });
    } catch {
      setNotice({
        type: "error",
        message: "Unable to calibrate. Please connect your phone to the Alino Wi-Fi and try again.",
      });
    } finally {
      setCalibrating(false);
    }
  };

  if (!activeDevice) {
    return <EmptyState title="Connect a device first" body="Connect and select your Alino before calibration." />;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Calibration</p>
        <h1>Calibrate Your Posture</h1>
      </div>

      <Notice notice={notice} />

      <div className="card">
        <h3>Before you calibrate</h3>
        <ol className="calibration-steps">
          <li>Clip the device correctly.</li>
          <li>Sit in your correct posture.</li>
          <li>Stay still for a few seconds.</li>
          <li>Tap Calibrate.</li>
        </ol>
        <button className="btn-primary" type="button" onClick={handleCalibrate} disabled={calibrating}>
          {calibrating ? <LoaderCircle className="spin" size={18} /> : <Target size={18} />}
          {calibrating ? "Calibrating..." : "Calibrate"}
        </button>
      </div>

      <div className="card">
        <h3>Active Calibration</h3>
        {activeCalibration ? (
          <dl className="details-list">
            <div className="details-row">
              <dt>Baseline angle</dt>
              <dd>{activeCalibration.baselineAngle}°</dd>
            </div>
            <div className="details-row">
              <dt>Threshold</dt>
              <dd>{activeCalibration.thresholdAngle}°</dd>
            </div>
            <div className="details-row">
              <dt>Saved</dt>
              <dd>{new Date(activeCalibration.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No active calibration saved for this device.</p>
        )}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════
   LIVE STATUS
   ══════════════════════════════════════════════════ */
function LiveStatusScreen({
  activeDevice,
  latestReading,
  todayReadings,
  onRefresh,
}: {
  activeDevice?: Device;
  latestReading: PostureReading | null;
  todayReadings: PostureReading[];
  onRefresh: () => Promise<void>;
}) {
  const { notice, run } = useNotice();
  const [deviceInfo, setDeviceInfo] = useState<AlinoDeviceInfo | null>(null);

  useEffect(() => {
    if (!activeDevice?.deviceIp) {
      setDeviceInfo(null);
      return;
    }

    let cancelled = false;
    setAlinoDeviceUrl(activeDevice.deviceIp);

    const poll = () => {
      alinoDevice
        .info()
        .then((info) => {
          if (!cancelled) setDeviceInfo(info);
        })
        .catch(() => {
          if (!cancelled) setDeviceInfo(null);
        });
    };

    poll();
    const intervalId = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeDevice?.deviceIp]);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDevice) {
      return;
    }
    const form = new FormData(event.currentTarget);

    run(async () => {
      await api.readings.create({
        deviceId: activeDevice.id,
        angle: numberValue(form.get("angle")),
        postureStatus: textValue(form.get("postureStatus")) as PostureStatus,
        recordedAt: new Date().toISOString(),
      });
      await onRefresh();
    }, "Test posture reading saved");
  };

  if (!activeDevice) {
    return <EmptyState title="Select a device" body="Live posture data is tied to an active device." />;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Live Posture</p>
        <h1>Current Status</h1>
      </div>

      <Notice notice={notice} />

      {/* Live status */}
      <div className="card">
        {latestReading ? (
          <PostureStatusDisplay reading={latestReading} />
        ) : (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>No data yet.</p>
        )}
      </div>

      {/* Live device telemetry: battery, straight from the device */}
      {deviceInfo && (
        <div className="metric-row">
          <MetricCard
            label="Battery"
            value={typeof deviceInfo.batteryPercent === "number" ? `${deviceInfo.batteryPercent}%` : "—"}
            accent={
              typeof deviceInfo.batteryPercent === "number" && deviceInfo.batteryPercent <= 20 ? "orange" : "green"
            }
          />
          <MetricCard
            label="Battery Voltage"
            value={typeof deviceInfo.batteryVoltage === "number" ? `${deviceInfo.batteryVoltage.toFixed(2)}V` : "—"}
            accent="gray"
          />
        </div>
      )}

      {/* Add test reading */}
      <div className="card">
        <h3>Add Test Reading</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label className="simple-label">
            Current angle
            <input className="simple-input" name="angle" type="number" step="0.1" placeholder="18.5" required />
          </label>
          <label className="simple-label">
            Status
            <select className="simple-select" name="postureStatus" defaultValue="good">
              <option value="good">Good</option>
              <option value="wrong">Wrong</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <button className="btn-primary" type="submit">
            <Plus size={18} />
            Save reading
          </button>
        </form>
      </div>

      {/* Today's readings chart */}
      <div className="card">
        <h3>Today's Readings</h3>
        <ReadingChart readings={todayReadings} />
      </div>
    </section>
  );
}

function ReadingChart({ readings }: { readings: PostureReading[] }) {
  const chartData = readings
    .slice()
    .reverse()
    .map((reading) => ({
      time: new Date(reading.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      angle: reading.angle,
    }));

  if (!readings.length) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No readings saved today.</p>;
  }

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
          <YAxis stroke="var(--text-muted)" />
          <Tooltip />
          <Line type="monotone" dataKey="angle" stroke="var(--brand)" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   DAILY PROGRESS
   ══════════════════════════════════════════════════ */
function DailyProgressScreen({ activeDevice }: { activeDevice?: Device }) {
  const { notice, run } = useNotice();
  const [date, setDate] = useState(todayKey());
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const loadProgress = () => {
    if (!activeDevice) {
      return;
    }

    run(async () => {
      const result = await api.progress.daily(activeDevice.id, date);
      setProgress(result.progress);
    });
  };

  useEffect(() => {
    loadProgress();
  }, [activeDevice?.id]);

  if (!activeDevice) {
    return <EmptyState title="Select a device" body="Daily progress is calculated per device." />;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Progress</p>
        <h1>Daily Progress</h1>
      </div>

      <Notice notice={notice} />

      <div className="card">
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            loadProgress();
          }}
        >
          <label className="simple-label" style={{ flex: 1 }}>
            Date
            <input className="simple-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="btn-primary" type="submit" style={{ maxWidth: 100, height: 48 }}>
            Load
          </button>
        </form>
      </div>

      {progress && <ProgressSummaryPanel progress={progress} score={progress.postureScore ?? 0} />}

      {/* Link to monthly */}
      <Link to="/progress/monthly" className="card" style={{ textAlign: "center", color: "var(--brand)", fontWeight: 700 }}>
        View Monthly Progress →
      </Link>
    </section>
  );
}

/* ══════════════════════════════════════════════════
   MONTHLY PROGRESS
   ══════════════════════════════════════════════════ */
function MonthlyProgressScreen({ activeDevice }: { activeDevice?: Device }) {
  const { notice, run } = useNotice();
  const [month, setMonth] = useState(monthKey());
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const loadProgress = () => {
    if (!activeDevice) {
      return;
    }

    run(async () => {
      const result = await api.progress.monthly(activeDevice.id, month);
      setProgress(result.progress);
    });
  };

  useEffect(() => {
    loadProgress();
  }, [activeDevice?.id]);

  if (!activeDevice) {
    return <EmptyState title="Select a device" body="Monthly progress is calculated per device." />;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Progress</p>
        <h1>Monthly Progress</h1>
      </div>

      <Notice notice={notice} />

      <div className="card">
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            loadProgress();
          }}
        >
          <label className="simple-label" style={{ flex: 1 }}>
            Month
            <input className="simple-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <button className="btn-primary" type="submit" style={{ maxWidth: 100, height: 48 }}>
            Load
          </button>
        </form>
      </div>

      {progress && (
        <>
          <ProgressSummaryPanel progress={progress} score={progress.monthlyAverageScore ?? 0} />
          <div className="card">
            <h3>Month Trend</h3>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={progress.days || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip />
                  <Bar dataKey="postureScore" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <Link to="/progress/daily" className="card" style={{ textAlign: "center", color: "var(--brand)", fontWeight: 700 }}>
        ← Back to Daily Progress
      </Link>
    </section>
  );
}

function ProgressSummaryPanel({ progress, score }: { progress: ProgressSummary; score: number }) {
  return (
    <div className="metric-row">
      <MetricCard label="Posture Score" value={`${score}%`} accent={score >= 70 ? "green" : "orange"} />
      <MetricCard label="Total Readings" value={String(progress.totalReadings)} accent="teal" />
      <MetricCard label="Avg Angle" value={`${progress.averageAngle}°`} accent="gray" />
      <MetricCard label="Wrong" value={String(progress.wrongReadings)} accent="orange" />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════ */
function SettingsScreen({ activeDevice }: { activeDevice?: Device }) {
  const { notice, run } = useNotice();
  const [settings, setSettings] = useState<DeviceSettings | null>(null);

  useEffect(() => {
    if (!activeDevice) {
      return;
    }

    api.settings
      .get(activeDevice.id)
      .then((result) => setSettings(result.settings))
      .catch(() => setSettings(null));
  }, [activeDevice?.id]);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDevice) {
      return;
    }
    const form = new FormData(event.currentTarget);

    run(async () => {
      const result = await api.settings.save({
        deviceId: activeDevice.id,
        sensitivity: textValue(form.get("sensitivity")) as DeviceSettings["sensitivity"],
        thresholdAngle: numberValue(form.get("thresholdAngle")),
        vibrationDelaySeconds: numberValue(form.get("vibrationDelaySeconds")),
        // The checkbox is labeled "Do not disturb", so checked means
        // vibration should be OFF - i.e. vibrationEnabled = false.
        vibrationEnabled: form.get("doNotDisturb") !== "on",
      });
      setSettings(result.settings);
    }, "Device settings saved");
  };

  if (!activeDevice) {
    return <EmptyState title="Select a device" body="Settings are saved per device." />;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Settings</p>
        <h1>Alert Behavior</h1>
      </div>

      <Notice notice={notice} />

      <div className="card">
        <h3>Device Settings</h3>
        <form className="settings-grid" onSubmit={handleSave} key={settings?.id || "new"}>
          <label className="simple-label">
            Sensitivity
            <select
              className="simple-select"
              name="sensitivity"
              defaultValue={settings?.sensitivity || "normal"}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="simple-label">
            Threshold angle
            <input
              className="simple-input"
              name="thresholdAngle"
              type="number"
              step="0.1"
              defaultValue={settings?.thresholdAngle ?? 12}
            />
          </label>
          <label className="simple-label">
            Vibration delay (sec)
            <input
              className="simple-input"
              name="vibrationDelaySeconds"
              type="number"
              min={1}
              defaultValue={settings?.vibrationDelaySeconds ?? 5}
            />
          </label>
          <div className="toggle-row">
            <input name="doNotDisturb" type="checkbox" defaultChecked={!(settings?.vibrationEnabled ?? true)} />
            Do not disturb (mutes the vibration alert)
          </div>
          <button className="btn-primary" type="submit">
            <Settings size={18} />
            Save settings
          </button>
        </form>
      </div>

      {/* Extra navigation links */}
      <Link to="/calibration" className="card" style={{ textAlign: "center", color: "var(--brand)", fontWeight: 700 }}>
        <Target size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
        Calibration Settings
      </Link>

      <Link to="/how-to-use" className="card" style={{ textAlign: "center", color: "var(--brand)", fontWeight: 700 }}>
        <HelpCircle size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
        How to Use Alino
      </Link>
    </section>
  );
}

/* ══════════════════════════════════════════════════
   HOW TO USE
   ══════════════════════════════════════════════════ */
function HowToUseScreen() {
  const steps = [
    "Charge the Alino device and turn it on with the physical switch.",
    "Connect the device to Wi-Fi and register it in the app with its ESP32 device UID.",
    "Sit or stand in your correct posture, then save a calibration baseline.",
    "Wear the device during use and monitor the live posture status screen.",
    "If wrong posture continues for about one minute, the vibration alert can activate.",
    "Review daily and monthly progress to understand long-term posture habits.",
  ];

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Guide</p>
        <h1>How to Use Alino</h1>
      </div>

      <div className="card">
        <div className="step-list">
          {steps.map((step, index) => (
            <div className="step-row" key={step}>
              <span className="step-number">{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════
   APP ROOT
   ══════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState(() => localStorage.getItem(ACTIVE_DEVICE_KEY) || "");
  const [booting, setBooting] = useState(true);
  const [latestReading, setLatestReading] = useState<PostureReading | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [todayReadings, setTodayReadings] = useState<PostureReading[]>([]);

  const activeDevice = useMemo(
    () => devices.find((device) => device.id === activeDeviceId),
    [devices, activeDeviceId],
  );

  const selectDevice = (deviceId: string) => {
    setActiveDeviceId(deviceId);
    if (deviceId) {
      localStorage.setItem(ACTIVE_DEVICE_KEY, deviceId);
    } else {
      localStorage.removeItem(ACTIVE_DEVICE_KEY);
    }
  };

  const loadDevices = async () => {
    const result = await api.devices.list();
    setDevices(result.devices);
    if (!activeDeviceId && result.devices[0]) {
      selectDevice(result.devices[0].id);
    }
  };

  useEffect(() => {
    if (!tokenStore.get()) {
      setBooting(false);
      return;
    }

    api.auth
      .me()
      .then(async (result) => {
        setUser(result.user);
        await loadDevices();
      })
      .catch(() => {
        tokenStore.clear();
        localStorage.removeItem(ACTIVE_DEVICE_KEY);
      })
      .finally(() => setBooting(false));
  }, []);

  const refreshLiveData = async () => {
    if (!activeDevice?.id) {
      setLatestReading(null);
      setProgressSummary(null);
      setTodayReadings([]);
      return;
    }

    const [latestResult, progressResult, todayResult] = await Promise.allSettled([
      api.readings.latest(activeDevice.id),
      api.progress.daily(activeDevice.id, todayKey()),
      api.readings.today(activeDevice.id),
    ]);

    if (latestResult.status === "fulfilled") {
      setLatestReading(latestResult.value.reading);
    } else {
      setLatestReading(null);
    }

    if (progressResult.status === "fulfilled") {
      setProgressSummary(progressResult.value.progress);
    } else {
      setProgressSummary(null);
    }

    if (todayResult.status === "fulfilled") {
      setTodayReadings(todayResult.value.readings);
    } else {
      setTodayReadings([]);
    }
  };

  useEffect(() => {
    if (!activeDevice?.id) {
      return;
    }

    void refreshLiveData();

    const intervalId = window.setInterval(() => {
      void refreshLiveData();
    }, 5000);

    const onFocus = () => {
      void refreshLiveData();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshLiveData();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeDevice?.id]);

  const handleAuth = async (nextUser: ApiUser, token: string) => {
    tokenStore.set(token);
    setUser(nextUser);
    await loadDevices().catch(() => setDevices([]));
  };

  const handleLogout = () => {
    tokenStore.clear();
    localStorage.removeItem(ACTIVE_DEVICE_KEY);
    setUser(null);
    setDevices([]);
    setActiveDeviceId("");
  };

  if (booting) {
    return (
      <main className="boot-screen">
        <BrandLogo className="boot-logo" />
        <span>Loading Alino</span>
      </main>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<AuthScreen mode="register" onAuth={handleAuth} />} />
        <Route path="/login" element={<AuthScreen mode="login" onAuth={handleAuth} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <ProtectedLayout
      user={user}
      devices={devices}
      activeDeviceId={activeDeviceId}
      onSelectDevice={selectDevice}
      onLogout={handleLogout}
    >
      <Routes>
        <Route
          path="/dashboard"
          element={<Dashboard devices={devices} activeDevice={activeDevice} latestReading={latestReading} progressSummary={progressSummary} />}
        />
        <Route
          path="/devices"
          element={
            <DeviceSetup
              devices={devices}
              activeDeviceId={activeDeviceId}
              onRefresh={loadDevices}
              onSelectDevice={selectDevice}
            />
          }
        />
        <Route path="/calibration" element={<CalibrationScreen activeDevice={activeDevice} />} />
        <Route
          path="/live"
          element={
            <LiveStatusScreen
              activeDevice={activeDevice}
              latestReading={latestReading}
              todayReadings={todayReadings}
              onRefresh={refreshLiveData}
            />
          }
        />
        <Route path="/progress/daily" element={<DailyProgressScreen activeDevice={activeDevice} />} />
        <Route path="/progress/monthly" element={<MonthlyProgressScreen activeDevice={activeDevice} />} />
        <Route path="/settings" element={<SettingsScreen activeDevice={activeDevice} />} />
        <Route path="/how-to-use" element={<HowToUseScreen />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ProtectedLayout>
  );
}

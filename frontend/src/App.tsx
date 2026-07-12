import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Gauge,
  HelpCircle,
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
  api,
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

/* ── Yoga / Meditation SVG Icon ── */
function YogaIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v4" />
      <path d="M8 14l4-4 4 4" />
      <path d="M6 18l6-4 6 4" />
    </svg>
  );
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
        <div className="brand-icon">
          <YogaIcon size={32} />
        </div>
        <h1>Alino</h1>
        <p>Precision posture & wellness</p>
      </div>

      {/* Auth card */}
      <section className="auth-card">
        <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p className="subtitle">
          {isRegister ? "Sign up to start tracking your posture." : "Enter your details to sign in."}
        </p>

        <Notice notice={notice} />

        <form className="form-stack" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="field-group">
              <div className="field-label">
                <label>NAME</label>
              </div>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input name="name" type="text" placeholder="Your full name" minLength={2} required />
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
                placeholder="sarah@example.com"
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
            <span className="brand-icon-sm">
              <YogaIcon size={18} />
            </span>
            <span>Alino</span>
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
function Dashboard({ devices, activeDevice }: { devices: Device[]; activeDevice?: Device }) {
  const { notice, setNotice } = useNotice();
  const [latest, setLatest] = useState<PostureReading | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  useEffect(() => {
    if (!activeDevice) {
      return;
    }

    Promise.allSettled([api.readings.latest(activeDevice.id), api.progress.daily(activeDevice.id, todayKey())]).then(
      ([latestResult, progressResult]) => {
        if (latestResult.status === "fulfilled") {
          setLatest(latestResult.value.reading);
        }
        if (progressResult.status === "fulfilled") {
          setProgress(progressResult.value.progress);
        }
        if (latestResult.status === "rejected" && progressResult.status === "rejected") {
          setNotice({ type: "info", message: "Add posture readings to see live dashboard data." });
        }
      },
    );
  }, [activeDevice, setNotice]);

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Home</p>
        <h1>Posture Overview</h1>
      </div>

      <Notice notice={notice} />

      {/* Metric cards */}
      <div className="metric-row">
        <MetricCard label="Devices" value={String(devices.length)} accent="teal" />
        <MetricCard label="Latest Angle" value={latest ? `${latest.angle}°` : "—"} accent="gray" />
        <MetricCard
          label="Today Score"
          value={progress ? `${progress.postureScore ?? 0}%` : "—"}
          accent={progress && (progress.postureScore ?? 0) >= 70 ? "green" : "orange"}
        />
        <MetricCard
          label="Readings"
          value={progress ? String(progress.totalReadings) : "—"}
          accent="teal"
        />
      </div>

      {activeDevice ? (
        <>
          {/* Posture status */}
          <div className="card">
            <h3>Current Posture</h3>
            {latest ? (
              <PostureStatusDisplay reading={latest} />
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
  const { notice, run } = useNotice();

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    run(async () => {
      const result = await api.devices.create({
        deviceName: textValue(form.get("deviceName")),
        deviceUid: textValue(form.get("deviceUid")),
        deviceIp: textValue(form.get("deviceIp")),
      });
      await onRefresh();
      onSelectDevice(result.device.id);
      event.currentTarget.reset();
    }, "Device registered successfully");
  };

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Devices</p>
        <h1>Manage Devices</h1>
      </div>

      <Notice notice={notice} />

      {/* Add device */}
      <div className="card">
        <h3>Add Device</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label className="simple-label">
            Device name
            <input className="simple-input" name="deviceName" placeholder="Alino Device 01" required />
          </label>
          <label className="simple-label">
            Device UID
            <input className="simple-input" name="deviceUid" placeholder="ESP32_001" required />
          </label>
          <label className="simple-label">
            Device IP
            <input className="simple-input" name="deviceIp" placeholder="192.168.4.1" required />
          </label>
          <button className="btn-primary" type="submit">
            <Plus size={18} />
            Add device
          </button>
        </form>
      </div>

      {/* Device list */}
      <div className="card">
        <h3>Registered Devices</h3>
        <div className="device-list">
          {devices.map((device) => (
            <button
              className={`device-row ${device.id === activeDeviceId ? "selected" : ""}`}
              key={device.id}
              type="button"
              onClick={() => onSelectDevice(device.id)}
            >
              <span className="device-info">
                <span className="device-name">{device.deviceName}</span>
                <span className="device-uid">{device.deviceUid}</span>
              </span>
              <span className="device-ip">{device.deviceIp}</span>
            </button>
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
  const { notice, run } = useNotice();
  const [activeCalibration, setActiveCalibration] = useState<Calibration | null>(null);

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

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeDevice) {
      return;
    }
    const form = new FormData(event.currentTarget);

    run(async () => {
      const result = await api.calibrations.create({
        deviceId: activeDevice.id,
        baselineAngle: numberValue(form.get("baselineAngle")),
        thresholdAngle: numberValue(form.get("thresholdAngle")),
      });
      setActiveCalibration(result.calibration);
    }, "Calibration saved successfully");
  };

  if (!activeDevice) {
    return <EmptyState title="Select a device" body="Calibration is saved per device." />;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <p className="eyebrow">Calibration</p>
        <h1>Posture Baseline</h1>
      </div>

      <Notice notice={notice} />

      <div className="card">
        <h3>New Calibration</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label className="simple-label">
            Baseline angle
            <input className="simple-input" name="baselineAngle" type="number" step="0.1" placeholder="8.5" required />
          </label>
          <label className="simple-label">
            Threshold angle
            <input className="simple-input" name="thresholdAngle" type="number" step="0.1" defaultValue={12} required />
          </label>
          <button className="btn-primary" type="submit">
            <Target size={18} />
            Save calibration
          </button>
        </form>
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
function LiveStatusScreen({ activeDevice }: { activeDevice?: Device }) {
  const { notice, run } = useNotice();
  const [latest, setLatest] = useState<PostureReading | null>(null);
  const [today, setToday] = useState<PostureReading[]>([]);

  const loadReadings = async () => {
    if (!activeDevice) {
      return;
    }

    const results = await Promise.allSettled([api.readings.latest(activeDevice.id), api.readings.today(activeDevice.id)]);

    if (results[0].status === "fulfilled") {
      setLatest(results[0].value.reading);
    } else {
      setLatest(null);
    }

    if (results[1].status === "fulfilled") {
      setToday(results[1].value.readings);
    } else {
      setToday([]);
    }
  };

  useEffect(() => {
    loadReadings();
  }, [activeDevice?.id]);

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
      await loadReadings();
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
        {latest ? (
          <PostureStatusDisplay reading={latest} />
        ) : (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>No data yet.</p>
        )}
      </div>

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
        <ReadingChart readings={today} />
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
        vibrationEnabled: form.get("vibrationEnabled") === "on",
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
        <form className="settings-grid" onSubmit={handleSave}>
          <label className="simple-label">
            Sensitivity
            <select
              className="simple-select"
              name="sensitivity"
              defaultValue={settings?.sensitivity || "normal"}
              key={settings?.id || "new"}
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
              min={0}
              defaultValue={settings?.vibrationDelaySeconds ?? 60}
            />
          </label>
          <div className="toggle-row">
            <input name="vibrationEnabled" type="checkbox" defaultChecked={settings?.vibrationEnabled ?? true} />
            Vibration enabled
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
        <div className="brand-icon">
          <YogaIcon size={32} />
        </div>
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
        <Route path="/dashboard" element={<Dashboard devices={devices} activeDevice={activeDevice} />} />
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
        <Route path="/live" element={<LiveStatusScreen activeDevice={activeDevice} />} />
        <Route path="/progress/daily" element={<DailyProgressScreen activeDevice={activeDevice} />} />
        <Route path="/progress/monthly" element={<MonthlyProgressScreen activeDevice={activeDevice} />} />
        <Route path="/settings" element={<SettingsScreen activeDevice={activeDevice} />} />
        <Route path="/how-to-use" element={<HowToUseScreen />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ProtectedLayout>
  );
}

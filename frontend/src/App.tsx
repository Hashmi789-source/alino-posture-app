import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Gauge,
  HelpCircle,
  LogOut,
  Plus,
  Radio,
  Settings,
  Smartphone,
  Target,
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <Radio size={28} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

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

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark">
          <Activity size={24} />
        </div>
        <h1>{isRegister ? "Create your Alino account" : "Welcome back to Alino"}</h1>
        <p className="muted">
          Track posture, calibrate your device, and review progress from one simple workspace.
        </p>
        <Notice notice={notice} />
        <form className="form-stack" onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              Name
              <input name="name" type="text" minLength={2} required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength={6} required />
          </label>
          <button className="primary-button" type="submit">
            <CheckCircle2 size={18} />
            {isRegister ? "Create account" : "Login"}
          </button>
        </form>
        <p className="switch-auth">
          {isRegister ? "Already have an account?" : "New to Alino?"}{" "}
          <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Login" : "Register"}</Link>
        </p>
      </section>
    </main>
  );
}

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
  const activeDevice = devices.find((device) => device.id === activeDeviceId);
  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Gauge },
    { path: "/devices", label: "Devices", icon: Smartphone },
    { path: "/calibration", label: "Calibration", icon: Target },
    { path: "/live", label: "Live status", icon: Activity },
    { path: "/progress/daily", label: "Daily", icon: CalendarDays },
    { path: "/progress/monthly", label: "Monthly", icon: BarChart3 },
    { path: "/settings", label: "Settings", icon: Settings },
    { path: "/how-to-use", label: "How to use", icon: HelpCircle },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="sidebar-brand" to="/dashboard">
          <span className="brand-mark small">
            <Activity size={20} />
          </span>
          <span>Alino</span>
        </Link>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={location.pathname === item.path ? "nav-link active" : "nav-link"}
                key={item.path}
                to={item.path}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Signed in as {user.name}</p>
            <h2>{activeDevice ? activeDevice.deviceName : "No active device selected"}</h2>
          </div>
          <div className="topbar-actions">
            <select value={activeDeviceId} onChange={(event) => onSelectDevice(event.target.value)}>
              <option value="">Select device</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.deviceName}
                </option>
              ))}
            </select>
            <button className="icon-button" type="button" onClick={onLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Home</p>
        <h1>Posture overview</h1>
      </div>
      <Notice notice={notice} />
      <div className="metric-grid">
        <MetricCard label="Registered devices" value={String(devices.length)} tone="blue" />
        <MetricCard label="Latest angle" value={latest ? `${latest.angle} deg` : "No data"} tone="gray" />
        <MetricCard
          label="Today score"
          value={progress ? `${progress.postureScore ?? 0}%` : "No data"}
          tone={progress && (progress.postureScore ?? 0) >= 70 ? "green" : "orange"}
        />
      </div>
      {activeDevice ? (
        <div className="split-grid">
          <section className="panel">
            <h2>Active device</h2>
            <dl className="details-list">
              <div>
                <dt>Device UID</dt>
                <dd>{activeDevice.deviceUid}</dd>
              </div>
              <div>
                <dt>Device IP</dt>
                <dd>{activeDevice.deviceIp}</dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <h2>Latest posture</h2>
            {latest ? <ReadingStatus reading={latest} /> : <p className="muted">No reading has been saved yet.</p>}
          </section>
        </div>
      ) : (
        <EmptyState title="Register a device first" body="Add your ESP32 device to unlock calibration and progress views." />
      )}
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "blue" | "green" | "orange" | "gray" }) {
  return (
    <section className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Devices</p>
        <h1>Register and manage Alino devices</h1>
      </div>
      <Notice notice={notice} />
      <div className="split-grid">
        <section className="panel">
          <h2>Add device</h2>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>
              Device name
              <input name="deviceName" placeholder="Alino Device 01" required />
            </label>
            <label>
              Device UID
              <input name="deviceUid" placeholder="ESP32_001" required />
            </label>
            <label>
              Device IP
              <input name="deviceIp" placeholder="192.168.4.1" required />
            </label>
            <button className="primary-button" type="submit">
              <Plus size={18} />
              Add device
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Registered devices</h2>
          <div className="device-list">
            {devices.map((device) => (
              <button
                className={device.id === activeDeviceId ? "device-row selected" : "device-row"}
                key={device.id}
                type="button"
                onClick={() => onSelectDevice(device.id)}
              >
                <span>
                  <strong>{device.deviceName}</strong>
                  <small>{device.deviceUid}</small>
                </span>
                <span>{device.deviceIp}</span>
              </button>
            ))}
          </div>
          {devices.length === 0 && <p className="muted">No devices registered yet.</p>}
        </section>
      </div>
    </section>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Calibration</p>
        <h1>Save the correct posture baseline</h1>
      </div>
      <Notice notice={notice} />
      <div className="split-grid">
        <section className="panel">
          <h2>New calibration</h2>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>
              Baseline angle
              <input name="baselineAngle" type="number" step="0.1" placeholder="8.5" required />
            </label>
            <label>
              Threshold angle
              <input name="thresholdAngle" type="number" step="0.1" defaultValue={12} required />
            </label>
            <button className="primary-button" type="submit">
              <Target size={18} />
              Save calibration
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Active calibration</h2>
          {activeCalibration ? (
            <dl className="details-list">
              <div>
                <dt>Baseline angle</dt>
                <dd>{activeCalibration.baselineAngle} deg</dd>
              </div>
              <div>
                <dt>Threshold</dt>
                <dd>{activeCalibration.thresholdAngle} deg</dd>
              </div>
              <div>
                <dt>Saved</dt>
                <dd>{new Date(activeCalibration.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">No active calibration saved for this device.</p>
          )}
        </section>
      </div>
    </section>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Live posture</p>
        <h1>Current posture status</h1>
      </div>
      <Notice notice={notice} />
      <div className="split-grid">
        <section className="panel status-panel">{latest ? <ReadingStatus reading={latest} /> : <p>No data yet.</p>}</section>
        <section className="panel">
          <h2>Add test reading</h2>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>
              Current angle
              <input name="angle" type="number" step="0.1" placeholder="18.5" required />
            </label>
            <label>
              Status
              <select name="postureStatus" defaultValue="good">
                <option value="good">Good</option>
                <option value="wrong">Wrong</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <button className="primary-button" type="submit">
              <Plus size={18} />
              Save reading
            </button>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>Today's readings</h2>
        <ReadingChart readings={today} />
      </section>
    </section>
  );
}

function ReadingStatus({ reading }: { reading: PostureReading }) {
  return (
    <div className={`reading-status ${reading.postureStatus}`}>
      <span className="status-dot" />
      <div>
        <p>{reading.postureStatus}</p>
        <strong>{reading.angle} deg</strong>
        <small>{new Date(reading.recordedAt).toLocaleString()}</small>
      </div>
    </div>
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
    return <p className="muted">No readings saved today.</p>;
  }

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="angle" stroke="#2563eb" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Progress</p>
        <h1>Daily progress</h1>
      </div>
      <Notice notice={notice} />
      <section className="panel">
        <form className="inline-form" onSubmit={(event) => (event.preventDefault(), loadProgress())}>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            <BarChart3 size={18} />
            Load
          </button>
        </form>
      </section>
      {progress && <ProgressSummaryPanel progress={progress} score={progress.postureScore ?? 0} />}
    </section>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Progress</p>
        <h1>Monthly progress</h1>
      </div>
      <Notice notice={notice} />
      <section className="panel">
        <form className="inline-form" onSubmit={(event) => (event.preventDefault(), loadProgress())}>
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            <BarChart3 size={18} />
            Load
          </button>
        </form>
      </section>
      {progress && (
        <>
          <ProgressSummaryPanel progress={progress} score={progress.monthlyAverageScore ?? 0} />
          <section className="panel">
            <h2>Month trend</h2>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={progress.days || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="postureScore" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function ProgressSummaryPanel({ progress, score }: { progress: ProgressSummary; score: number }) {
  return (
    <div className="metric-grid">
      <MetricCard label="Posture score" value={`${score}%`} tone={score >= 70 ? "green" : "orange"} />
      <MetricCard label="Total readings" value={String(progress.totalReadings)} tone="blue" />
      <MetricCard label="Average angle" value={`${progress.averageAngle} deg`} tone="gray" />
      <MetricCard label="Wrong readings" value={String(progress.wrongReadings)} tone="orange" />
    </div>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Device settings</p>
        <h1>Posture alert behavior</h1>
      </div>
      <Notice notice={notice} />
      <section className="panel">
        <form className="settings-form" onSubmit={handleSave}>
          <label>
            Sensitivity
            <select name="sensitivity" defaultValue={settings?.sensitivity || "normal"} key={settings?.id || "new"}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Threshold angle
            <input name="thresholdAngle" type="number" step="0.1" defaultValue={settings?.thresholdAngle ?? 12} />
          </label>
          <label>
            Vibration delay seconds
            <input
              name="vibrationDelaySeconds"
              type="number"
              min={0}
              defaultValue={settings?.vibrationDelaySeconds ?? 60}
            />
          </label>
          <label className="toggle-row">
            <input name="vibrationEnabled" type="checkbox" defaultChecked={settings?.vibrationEnabled ?? true} />
            Vibration enabled
          </label>
          <button className="primary-button" type="submit">
            <Settings size={18} />
            Save settings
          </button>
        </form>
      </section>
    </section>
  );
}

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
      <div className="page-heading">
        <p className="eyebrow">Guide</p>
        <h1>How to use Alino</h1>
      </div>
      <section className="panel">
        <div className="step-list">
          {steps.map((step, index) => (
            <div className="step-row" key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

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
        <Activity size={28} />
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

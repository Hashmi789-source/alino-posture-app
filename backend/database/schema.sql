create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_name text not null,
  device_uid text unique not null,
  device_ip text,
  created_at timestamptz default now()
);

create table if not exists calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  baseline_angle numeric not null,
  threshold_angle numeric not null default 12,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists posture_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  angle numeric not null,
  posture_status text not null check (posture_status in ('good', 'wrong', 'unknown')),
  recorded_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists device_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid unique references devices(id) on delete cascade,
  sensitivity text not null default 'normal' check (sensitivity in ('low', 'normal', 'high')),
  threshold_angle numeric not null default 12,
  vibration_delay_seconds integer not null default 60,
  vibration_enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_devices_user_id on devices(user_id);

create index if not exists idx_calibrations_user_id on calibrations(user_id);
create index if not exists idx_calibrations_device_id on calibrations(device_id);

create index if not exists idx_posture_readings_user_id on posture_readings(user_id);
create index if not exists idx_posture_readings_device_id on posture_readings(device_id);
create index if not exists idx_posture_readings_recorded_at on posture_readings(recorded_at);

create index if not exists idx_device_settings_user_id on device_settings(user_id);
create index if not exists idx_device_settings_device_id on device_settings(device_id);

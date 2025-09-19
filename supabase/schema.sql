
create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone_e164 text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  patient_name text not null,
  phone_e164 text not null,
  appointment_at timestamptz not null, -- UTC
  duration_min int not null default 30,
  chair int not null default 1,
  timezone text not null default 'Europe/Rome',
  review_delay_hours int not null default 2,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  type text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending',
  payload jsonb,
  last_error text
);

create index if not exists idx_contacts_phone on public.contacts(phone_e164);
create index if not exists idx_messages_status_scheduled on public.messages(status, scheduled_at);
create index if not exists idx_appt_day on public.appointments(appointment_at);

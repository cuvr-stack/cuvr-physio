-- ============================================================
-- CuVR Physio — initial schema
-- Run against your Supabase project via the SQL editor or CLI:
--   supabase db push
-- ============================================================

-- ── Profiles (physio / admin users extend auth.users) ────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text        not null,
  role        text        not null default 'physio' check (role in ('physio','admin')),
  clinic_name text,
  created_at  timestamptz not null default now()
);

-- Auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Patients ──────────────────────────────────────────────────
create table if not exists public.patients (
  id           uuid        primary key default gen_random_uuid(),
  physio_id    uuid        not null references public.profiles(id) on delete cascade,
  name         text        not null,
  email        text,
  date_of_birth date,
  condition    text        not null,
  -- 6-char uppercase code used to start a VR session (no password needed on headset)
  session_code text        not null unique default upper(substring(gen_random_uuid()::text, 1, 6)),
  created_at   timestamptz not null default now()
);

-- ── Sessions ──────────────────────────────────────────────────
create table if not exists public.sessions (
  id             uuid        primary key default gen_random_uuid(),
  patient_id     uuid        not null references public.patients(id) on delete cascade,
  exercise_id    text        not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  status         text        not null default 'active' check (status in ('active','completed','paused')),
  score          int         not null default 0,
  reps_completed int         not null default 0
);

-- ── Session results (per-session summary saved on completion) ─
create table if not exists public.session_results (
  id               uuid        primary key default gen_random_uuid(),
  session_id       uuid        not null references public.sessions(id) on delete cascade,
  exercise_id      text        not null,
  reps_completed   int         not null default 0,
  max_rom          int         not null default 0,
  avg_rom          int         not null default 0,
  duration_seconds int         not null default 0,
  score            int         not null default 0,
  completed_at     timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.patients        enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_results enable row level security;

-- Profiles: users see only their own row
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- Patients: physio sees only their own patients
create policy "Own patients" on public.patients
  for all using (auth.uid() = physio_id);

-- Sessions: physio sees sessions for their patients
create policy "Own sessions" on public.sessions
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.physio_id = auth.uid()
    )
  );

-- Session results: same scope as sessions
create policy "Own results" on public.session_results
  for all using (
    exists (
      select 1 from public.sessions s
      join public.patients p on p.id = s.patient_id
      where s.id = session_id and p.physio_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_patients_physio   on public.patients(physio_id);
create index if not exists idx_patients_code     on public.patients(session_code);
create index if not exists idx_sessions_patient  on public.sessions(patient_id);
create index if not exists idx_results_session   on public.session_results(session_id);

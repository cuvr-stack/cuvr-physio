-- ============================================================
-- CuVR Physio — appointments / scheduling
-- ============================================================

create table if not exists public.appointments (
  id            uuid        primary key default gen_random_uuid(),
  physio_id     uuid        not null references public.profiles(id)  on delete cascade,
  patient_id    uuid        not null references public.patients(id)  on delete cascade,
  scheduled_at  timestamptz not null,
  duration_min  int         not null default 45,
  exercise_id   text        not null default 'general',
  status        text        not null default 'scheduled'
                            check (status in ('scheduled','cancelled','completed')),
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.appointments enable row level security;

-- Physio sees and manages only their own appointments
create policy "Own appointments" on public.appointments
  for all using (auth.uid() = physio_id);

create index if not exists idx_appointments_physio   on public.appointments(physio_id);
create index if not exists idx_appointments_patient  on public.appointments(patient_id);
create index if not exists idx_appointments_schedule on public.appointments(scheduled_at);

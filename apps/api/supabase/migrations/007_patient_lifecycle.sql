-- ============================================================
-- CuVR Physio — patient lifecycle (discharge workflow)
--
-- Adds a manual lifecycle status to the patients table so a physio
-- can mark a patient as discharged when their treatment is complete,
-- without losing the historical record.
-- ============================================================

alter table public.patients
  add column if not exists status text not null default 'active'
    check (status in ('active','discharged'));

alter table public.patients
  add column if not exists discharged_at timestamptz;

alter table public.patients
  add column if not exists discharged_reason text;

create index if not exists idx_patients_status on public.patients(status);

-- Reload the API schema cache so PostgREST sees the new columns immediately
notify pgrst, 'reload schema';

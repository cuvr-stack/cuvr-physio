-- ============================================================
-- CuVR Physio — patient demographics
--
-- Adds the fields needed for height-scaled VR target placement,
-- side-specific exercise lateralisation, and age-appropriate
-- difficulty presets in the AI coach prompt.
-- (date_of_birth already exists from migration 001.)
-- ============================================================

alter table public.patients
  add column if not exists height_cm     int
    check (height_cm is null or (height_cm between 50 and 250));

alter table public.patients
  add column if not exists affected_side text
    check (affected_side is null or affected_side in ('left','right','bilateral'));

create index if not exists idx_patients_affected_side on public.patients(affected_side);

notify pgrst, 'reload schema';

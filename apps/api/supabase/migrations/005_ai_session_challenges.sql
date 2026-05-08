-- ============================================================
-- CuVR Physio — AI-generated session challenges
-- One per session: a small personalised goal the patient can
-- earn within the session's runtime.
-- ============================================================

create table if not exists public.ai_session_challenges (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null unique references public.sessions(id) on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  title       text        not null,
  description text        not null,
  criteria    jsonb       not null,        -- { type, threshold, reps?, stddev_max? }
  xp_reward   int         not null default 50,
  status      text        not null default 'active' check (status in ('active','earned','expired')),
  earned_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_challenges_patient on public.ai_session_challenges(patient_id);
create index if not exists idx_ai_challenges_status  on public.ai_session_challenges(status);

alter table public.ai_session_challenges enable row level security;

create policy "physio reads own challenges" on public.ai_session_challenges for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = ai_session_challenges.patient_id
        and p.physio_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

-- ============================================================
-- CuVR Physio — AI coach events
-- One row per LLM decision, observation, or error during a session.
-- ============================================================

create table if not exists public.ai_coach_events (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.sessions(id) on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  ts          timestamptz not null default now(),
  kind        text        not null check (kind in ('decision','observation','error')),
  payload     jsonb       not null
);

create index if not exists idx_ai_coach_events_session on public.ai_coach_events(session_id);
create index if not exists idx_ai_coach_events_patient on public.ai_coach_events(patient_id);
create index if not exists idx_ai_coach_events_ts      on public.ai_coach_events(ts desc);

alter table public.ai_coach_events enable row level security;

-- Physio can read coach events for their own patients
create policy "physio reads own ai events" on public.ai_coach_events for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = ai_coach_events.patient_id
        and p.physio_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

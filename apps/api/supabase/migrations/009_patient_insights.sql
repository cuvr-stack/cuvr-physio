-- ============================================================
-- CuVR Physio — longitudinal patient insights
--
-- Stores AI-generated analysis of a patient's session history:
-- trend, re-injury risk, headline, summary, recommendation,
-- and the raw feature vector that produced it (for transparency).
-- One row per analysis run.
-- ============================================================

create table if not exists public.ai_patient_insights (
  id              uuid        primary key default gen_random_uuid(),
  patient_id      uuid        not null references public.patients(id) on delete cascade,
  generated_at    timestamptz not null default now(),
  trend           text        not null check (trend in ('improving','steady','plateau','regressing','insufficient_data')),
  risk_level      text        not null check (risk_level in ('low','moderate','high','unknown')),
  headline        text        not null,
  summary         text        not null,
  recommendation  text,
  evidence        jsonb       not null default '[]'::jsonb,
  features        jsonb       not null default '{}'::jsonb,
  sessions_analyzed int       not null default 0
);

create index if not exists idx_insights_patient   on public.ai_patient_insights(patient_id);
create index if not exists idx_insights_generated on public.ai_patient_insights(generated_at desc);

alter table public.ai_patient_insights enable row level security;

create policy "physio reads own patient insights" on public.ai_patient_insights for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = ai_patient_insights.patient_id
        and p.physio_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

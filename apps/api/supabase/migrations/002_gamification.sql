-- ============================================================
-- CuVR Physio — gamification schema
-- ============================================================

-- ── Achievement catalog (static, seeded below) ───────────────
create table if not exists public.achievements (
  id          text        primary key,
  name        text        not null,
  description text        not null,
  icon        text        not null,  -- emoji
  xp_reward   int         not null default 50,
  created_at  timestamptz not null default now()
);

-- ── Player stats (one row per patient) ───────────────────────
create table if not exists public.player_stats (
  patient_id      uuid        primary key references public.patients(id) on delete cascade,
  xp              int         not null default 0,
  level           int         not null default 1,
  total_reps      int         not null default 0,
  total_sessions  int         not null default 0,
  best_rom        int         not null default 0,
  current_streak  int         not null default 0,
  longest_streak  int         not null default 0,
  last_session_at date,
  updated_at      timestamptz not null default now()
);

-- ── Earned achievements (junction) ───────────────────────────
create table if not exists public.player_achievements (
  id             uuid        primary key default gen_random_uuid(),
  patient_id     uuid        not null references public.patients(id) on delete cascade,
  achievement_id text        not null references public.achievements(id),
  earned_at      timestamptz not null default now(),
  unique (patient_id, achievement_id)
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.achievements       enable row level security;
alter table public.player_stats       enable row level security;
alter table public.player_achievements enable row level security;

-- Achievements catalog is public-read
create policy "Public read achievements" on public.achievements
  for select using (true);

-- Player stats visible to the physio who owns the patient
create policy "Physio reads player stats" on public.player_stats
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.physio_id = auth.uid()
    )
  );

create policy "Physio reads player achievements" on public.player_achievements
  for all using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.physio_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_player_achievements_patient on public.player_achievements(patient_id);

-- ── Seed achievement catalog ──────────────────────────────────
insert into public.achievements (id, name, description, icon, xp_reward) values
  ('first_rep',      'First Rep',          'Complete your very first rep',                       '🎯', 25),
  ('rep_10',         'Ten Reps',           'Complete 10 reps in a single session',               '💪', 50),
  ('rep_50',         'Half Century',       'Complete 50 total reps across all sessions',         '🏃', 75),
  ('rep_100',        'Century Club',       'Complete 100 total reps',                            '🏆', 150),
  ('rom_90',         '90° Milestone',      'Reach 90° range of motion',                         '📐', 40),
  ('rom_120',        '120° Milestone',     'Reach 120° range of motion',                         '📐', 60),
  ('rom_150',        '150° Milestone',     'Reach 150° range of motion',                         '📐', 80),
  ('rom_180',        'Full Range',         'Achieve full 180° range of motion',                  '⭐', 200),
  ('perfect_rep',    'Perfect Form',       'Complete a rep at 100% or more of the target ROM',   '✨', 75),
  ('streak_3',       '3-Day Streak',       'Complete sessions 3 days in a row',                  '🔥', 100),
  ('streak_7',       '7-Day Streak',       'Complete sessions 7 days in a row',                  '🔥', 250),
  ('level_5',        'Level 5',            'Reach player level 5',                               '⬆️', 100),
  ('level_10',       'Level 10',           'Reach player level 10',                              '🌟', 300)
on conflict (id) do nothing;

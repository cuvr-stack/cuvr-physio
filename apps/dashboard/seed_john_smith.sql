-- ============================================================
-- Seed: John Smith — 12 completed sessions showing ROM improvement
-- Run this in your Supabase SQL Editor (it auto-runs as service role)
-- ============================================================

DO $$
DECLARE
  v_physio_id   uuid;
  v_patient_id  uuid;
  v_session_id  uuid;
BEGIN

  -- ── 1. Get your physio user ───────────────────────────────
  SELECT id INTO v_physio_id FROM public.profiles LIMIT 1;
  IF v_physio_id IS NULL THEN
    RAISE EXCEPTION 'No profile found. Make sure you have signed up and confirmed your email first.';
  END IF;
  RAISE NOTICE 'Using physio_id: %', v_physio_id;

  -- ── 2. Create John Smith patient ─────────────────────────
  INSERT INTO public.patients (physio_id, name, condition, email)
  VALUES (v_physio_id, 'John Smith', 'Shoulder Impingement Syndrome', 'john.smith@example.com')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_patient_id;

  -- If already exists, fetch him
  IF v_patient_id IS NULL THEN
    SELECT id INTO v_patient_id
    FROM public.patients
    WHERE physio_id = v_physio_id AND name = 'John Smith'
    LIMIT 1;
  END IF;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Could not create or find John Smith patient.';
  END IF;
  RAISE NOTICE 'Patient id: %', v_patient_id;

  -- ── 3. Delete old dummy data for clean re-runs ───────────
  DELETE FROM public.player_achievements WHERE patient_id = v_patient_id;
  DELETE FROM public.player_stats         WHERE patient_id = v_patient_id;
  DELETE FROM public.session_results
    WHERE session_id IN (SELECT id FROM public.sessions WHERE patient_id = v_patient_id);
  DELETE FROM public.sessions WHERE patient_id = v_patient_id;

  -- ── 4. Insert 12 sessions (ROM improves from 40° → 145°) ─

  -- Session 1 — 90 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '90 days',
          NOW() - INTERVAL '90 days' + INTERVAL '20 minutes',
          'completed', 720, 6)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 6, 40, 55, 1200, 720);

  -- Session 2 — 83 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '83 days',
          NOW() - INTERVAL '83 days' + INTERVAL '22 minutes',
          'completed', 880, 7)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 7, 48, 62, 1320, 880);

  -- Session 3 — 76 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_abduction',
          NOW() - INTERVAL '76 days',
          NOW() - INTERVAL '76 days' + INTERVAL '25 minutes',
          'completed', 1020, 8)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_abduction', 8, 55, 70, 1500, 1020);

  -- Session 4 — 70 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '70 days',
          NOW() - INTERVAL '70 days' + INTERVAL '26 minutes',
          'completed', 1100, 8)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 8, 63, 78, 1560, 1100);

  -- Session 5 — 63 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_abduction',
          NOW() - INTERVAL '63 days',
          NOW() - INTERVAL '63 days' + INTERVAL '28 minutes',
          'completed', 1350, 10)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_abduction', 10, 72, 88, 1680, 1350);

  -- Session 6 — 56 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '56 days',
          NOW() - INTERVAL '56 days' + INTERVAL '30 minutes',
          'completed', 1480, 10)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 10, 80, 98, 1800, 1480);

  -- Session 7 — 49 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'elbow_extension',
          NOW() - INTERVAL '49 days',
          NOW() - INTERVAL '49 days' + INTERVAL '32 minutes',
          'completed', 1650, 12)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'elbow_extension', 12, 88, 108, 1920, 1650);

  -- Session 8 — 42 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '42 days',
          NOW() - INTERVAL '42 days' + INTERVAL '33 minutes',
          'completed', 1780, 12)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 12, 96, 116, 1980, 1780);

  -- Session 9 — 35 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_abduction',
          NOW() - INTERVAL '35 days',
          NOW() - INTERVAL '35 days' + INTERVAL '34 minutes',
          'completed', 1900, 12)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_abduction', 12, 105, 122, 2040, 1900);

  -- Session 10 — 28 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '28 days',
          NOW() - INTERVAL '28 days' + INTERVAL '36 minutes',
          'completed', 2100, 15)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 15, 112, 130, 2160, 2100);

  -- Session 11 — 14 days ago
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'elbow_extension',
          NOW() - INTERVAL '14 days',
          NOW() - INTERVAL '14 days' + INTERVAL '37 minutes',
          'completed', 2250, 15)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'elbow_extension', 15, 120, 138, 2220, 2250);

  -- Session 12 — 7 days ago (most recent)
  INSERT INTO public.sessions (patient_id, exercise_id, started_at, ended_at, status, score, reps_completed)
  VALUES (v_patient_id, 'shoulder_flexion',
          NOW() - INTERVAL '7 days',
          NOW() - INTERVAL '7 days' + INTERVAL '38 minutes',
          'completed', 2400, 15)
  RETURNING id INTO v_session_id;
  INSERT INTO public.session_results (session_id, exercise_id, reps_completed, avg_rom, max_rom, duration_seconds, score)
  VALUES (v_session_id, 'shoulder_flexion', 15, 126, 145, 2280, 2400);

  -- ── 5. Player stats ───────────────────────────────────────
  -- Total reps: 6+7+8+8+10+10+12+12+12+15+15+15 = 130
  -- XP: 2100  → level = floor(sqrt(2100/50))+1 = floor(6.48)+1 = 7
  INSERT INTO public.player_stats
    (patient_id, xp, level, total_reps, total_sessions, best_rom, current_streak, longest_streak, last_session_at)
  VALUES
    (v_patient_id, 2100, 7, 130, 12, 145, 5, 7, CURRENT_DATE - INTERVAL '7 days');

  -- ── 6. Achievements ───────────────────────────────────────
  INSERT INTO public.player_achievements (patient_id, achievement_id, earned_at) VALUES
    (v_patient_id, 'first_rep',   NOW() - INTERVAL '90 days'),
    (v_patient_id, 'rep_10',      NOW() - INTERVAL '83 days'),
    (v_patient_id, 'rep_50',      NOW() - INTERVAL '56 days'),
    (v_patient_id, 'rep_100',     NOW() - INTERVAL '28 days'),
    (v_patient_id, 'rom_90',      NOW() - INTERVAL '56 days'),
    (v_patient_id, 'rom_120',     NOW() - INTERVAL '35 days'),
    (v_patient_id, 'perfect_rep', NOW() - INTERVAL '49 days'),
    (v_patient_id, 'streak_3',    NOW() - INTERVAL '63 days'),
    (v_patient_id, 'streak_7',    NOW() - INTERVAL '35 days'),
    (v_patient_id, 'level_5',     NOW() - INTERVAL '42 days')
  ON CONFLICT (patient_id, achievement_id) DO NOTHING;

  RAISE NOTICE '✅ Done! John Smith seeded with 12 sessions, 130 reps, level 7, 10 achievements.';

END $$;

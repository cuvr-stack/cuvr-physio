-- ============================================================
-- CuVR Physio — VAS pain capture
--
-- Adds pre/post-session pain ratings (0–10 visual analog scale)
-- so the SOAP note's Subjective section has real patient input.
-- ============================================================

alter table public.sessions
  add column if not exists pain_at_start int
    check (pain_at_start is null or (pain_at_start between 0 and 10));

alter table public.sessions
  add column if not exists pain_at_end int
    check (pain_at_end is null or (pain_at_end between 0 and 10));

notify pgrst, 'reload schema';

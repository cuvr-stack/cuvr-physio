-- ============================================================
-- CuVR Physio — automatic stale-session cleanup
--
-- Runs every 10 minutes via pg_cron. Catches any 'active' session
-- whose API socket disconnect handler didn't run (API restart,
-- process crash, schema-cache miss, etc.). Anything still active
-- after 2 hours is treated as orphaned.
--
-- IMPORTANT — pg_cron must be enabled at the project level:
--   Supabase dashboard → Database → Extensions → search "pg_cron" → Enable
-- This migration also `create extension if not exists` as a fallback.
-- ============================================================

create extension if not exists pg_cron;

-- Make sure we don't double-schedule if this migration ever runs twice
do $$
begin
  perform cron.unschedule('cleanup-stale-sessions');
exception
  when others then null;   -- swallow "job not found"
end $$;

select cron.schedule(
  'cleanup-stale-sessions',
  '*/10 * * * *',                    -- every 10 minutes
  $$
    update public.sessions
    set status   = 'completed',
        ended_at = coalesce(ended_at, started_at + interval '5 minutes')
    where status     = 'active'
      and started_at < now() - interval '2 hours'
  $$
);

-- Reload PostgREST cache so any new objects show up immediately
notify pgrst, 'reload schema';

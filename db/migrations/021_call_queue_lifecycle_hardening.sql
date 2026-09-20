-- Manlung Recovery
-- Call queue/lifecycle hardening.
--
-- Migration 008 predates queued calls and therefore excluded `queued`
-- from the status constraint. Keep the historical migration untouched
-- and repair the live schema here.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.recovery_call_sessions'::regclass
      AND conname = 'recovery_call_sessions_status_check'
  ) THEN
    ALTER TABLE public.recovery_call_sessions
      DROP CONSTRAINT recovery_call_sessions_status_check;
  END IF;

  ALTER TABLE public.recovery_call_sessions
    ADD CONSTRAINT recovery_call_sessions_status_check
    CHECK (
      status IN (
        'ringing',
        'queued',
        'accepted',
        'ended',
        'rejected',
        'missed',
        'failed'
      )
    );
END $$;

NOTIFY pgrst, 'reload schema';

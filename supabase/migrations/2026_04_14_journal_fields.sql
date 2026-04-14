-- Migration: expand daily_tasks into a persistent journal.
-- Adds three long-lived text fields that the journal UI reviews across
-- months, plus indexes to make ilike search cheap enough to run on every
-- keystroke.

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS aprendizajes TEXT,
  ADD COLUMN IF NOT EXISTS notas        TEXT,
  ADD COLUMN IF NOT EXISTS meta_entreno TEXT;

-- Reviewable history is scoped to one user, so the composite index
-- (user_id, fecha DESC) covers both the journal history view and the
-- weekly-focus lookups.
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_fecha_desc
  ON public.daily_tasks(user_id, fecha DESC);

-- Trigram index for case-insensitive substring search across journal text.
-- Required extension — usually already enabled in Supabase projects, but
-- we declare it here for fresh deploys.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_observaciones_trgm
  ON public.daily_tasks USING gin (observaciones gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_aprendizajes_trgm
  ON public.daily_tasks USING gin (aprendizajes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_notas_trgm
  ON public.daily_tasks USING gin (notas gin_trgm_ops);

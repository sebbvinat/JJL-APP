-- Onboarding tour state: tracks where in the 5-step welcome flow a user is
-- and when/if they completed it. NULL onboarding_completed_at means the
-- middleware will redirect them to /bienvenida.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1
    CHECK (onboarding_step BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Partial index so the middleware check (onboarding_completed_at IS NULL)
-- stays cheap even with thousands of completed users.
CREATE INDEX IF NOT EXISTS idx_users_onboarding_pending
  ON public.users(id)
  WHERE onboarding_completed_at IS NULL;

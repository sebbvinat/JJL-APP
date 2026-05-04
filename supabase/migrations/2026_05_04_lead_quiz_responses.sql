-- Lead magnet: quiz responses captured BEFORE the lead books on Calendly.
-- Lets the team see who's filtering in (and what they say about themselves)
-- even if they never complete the booking step.

CREATE TABLE IF NOT EXISTS public.lead_quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,                 -- client-generated, lets us join with bookings later
  fortaleza TEXT NOT NULL,                  -- Q1: principal fortaleza fisica
  limitacion TEXT NOT NULL,                 -- Q2: aspecto que mas lo limita
  experiencia TEXT NOT NULL,                -- Q3: hace cuanto entrena
  email TEXT,                               -- optional, captured later via Calendly webhook
  nombre TEXT,                              -- optional
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_quiz_session
  ON public.lead_quiz_responses (session_id);

CREATE INDEX IF NOT EXISTS idx_lead_quiz_created
  ON public.lead_quiz_responses (created_at DESC);

ALTER TABLE public.lead_quiz_responses ENABLE ROW LEVEL SECURITY;

-- Inserts come from anon visitors via the API route (service role bypasses RLS),
-- so we deny direct client-side writes by default.
CREATE POLICY "lead_quiz_admin_select" ON public.lead_quiz_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.rol = 'admin'
    )
  );

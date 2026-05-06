-- Calendly webhook fields. El webhook `invitee.created` nos envía nombre,
-- email y fecha/hora del agendamiento; los guardamos para mostrarlos en
-- /admin/agendas sin tener que llamar a la API de Calendly cada vez.

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_quiz_scheduled_at
  ON public.lead_quiz_responses (scheduled_at DESC);

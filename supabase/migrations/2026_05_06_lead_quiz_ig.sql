-- Quiz v3: instagram + ocupación reemplazan a la pregunta de urgencia.
-- Ambas son nullable porque también pueden saltearse.

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS instagram TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS ocupacion TEXT;

-- Buscar leads por usuario de IG (útil cuando el coach lo busca para
-- reenganchar manualmente desde Instagram).
CREATE INDEX IF NOT EXISTS idx_lead_quiz_instagram
  ON public.lead_quiz_responses (LOWER(instagram));

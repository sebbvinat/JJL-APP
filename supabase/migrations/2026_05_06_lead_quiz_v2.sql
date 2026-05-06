-- Lead quiz v2: rediseño del cuestionario de calificación.
--   * Nuevas preguntas: vision, estado, compromiso, urgencia (sustituyen a
--     limitacion / experiencia en la UI).
--   * Telefono + pais se capturan DESPUÉS de agendar en Calendly.
--   * Si el lead se autoexcluye (compromiso='viendo' o urgencia='no'),
--     se marca disqualified=true y NO se le muestra el calendario.

-- Todos los campos del quiz pasan a ser nullable: el flujo en dos partes
-- (quiz → reserva en Calendly → teléfono) puede dejar filas con datos
-- parciales si algún paso falla, y queremos capturar lo que tengamos.
ALTER TABLE public.lead_quiz_responses
  ALTER COLUMN fortaleza DROP NOT NULL;

ALTER TABLE public.lead_quiz_responses
  ALTER COLUMN limitacion DROP NOT NULL;

ALTER TABLE public.lead_quiz_responses
  ALTER COLUMN experiencia DROP NOT NULL;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS vision TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS estado TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS compromiso TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS urgencia TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS telefono TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS pais TEXT;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS disqualified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS booked BOOLEAN NOT NULL DEFAULT FALSE;

-- session_id debe ser único para poder hacer upsert desde la API
-- (insert al terminar el quiz + update con teléfono post-agenda).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_quiz_responses_session_id_key'
  ) THEN
    ALTER TABLE public.lead_quiz_responses
      ADD CONSTRAINT lead_quiz_responses_session_id_key UNIQUE (session_id);
  END IF;
END $$;

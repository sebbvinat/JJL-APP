-- Setter notifications: dos timestamps idempotentes en lead_quiz_responses.
--
-- ¿Por qué columnas separadas del followed_up_at existente?
-- `followed_up_at` lo marca el cron leads-followup que avisa al COACH por
-- WhatsApp después de 30 min. Acá queremos rutas paralelas para el setter
-- (panel admin + push browser) con su propio SLA de 2 horas. No queremos
-- que un canal "marque" al otro y termine ahogando alguna alerta.

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS setter_notified_booked_at TIMESTAMPTZ;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS setter_notified_no_book_at TIMESTAMPTZ;

-- Index para el filtro del cron SLA-no-book — escanea filas recientes con
-- booked=false que aún no fueron notificadas al setter.
CREATE INDEX IF NOT EXISTS idx_lead_quiz_setter_pending_nobook
  ON public.lead_quiz_responses (created_at)
  WHERE booked = FALSE
    AND disqualified = FALSE
    AND setter_notified_no_book_at IS NULL;

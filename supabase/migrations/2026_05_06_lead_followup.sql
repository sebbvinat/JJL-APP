-- Marca para no spamear el mismo lead en el WhatsApp diario de follow-up.
-- El cron /api/cron/leads-followup busca filas con quiz completo, sin
-- agendar y followed_up_at IS NULL — las notifica al coach y las marca
-- como ya seguidas.

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS followed_up_at TIMESTAMPTZ;

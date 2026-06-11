-- Marca de "casi agendó" en lead_quiz_responses.
--
-- El widget de Calendly emite `calendly.date_and_time_selected` cuando el
-- lead ya eligió día y hora — está a un click de confirmar. Si en ese punto
-- cierra la pestaña sin disparar `event_scheduled`, perdimos un lead caliente.
-- Persistimos ese momento acá para:
--   1) Disparar follow-up al setter (WhatsApp con link wa.me pre-armado)
--   2) Tener métrica de "near-miss rate" en el Kanban
--
-- Idempotente.
ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS near_miss_at timestamptz;

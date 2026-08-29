-- Tracking de carga del widget de Calendly embebido.
--
-- Sospecha: el iframe de Calendly tarda en cargar y una parte de los leads
-- se va ANTES de ver el calendario. Para medirlo persistimos dos momentos
-- que el widget emite por postMessage al window padre:
--   - `calendly.event_type_viewed`      → el widget terminó de cargar y el
--     lead lo vio                        → calendly_loaded_at
--   - `calendly.date_and_time_selected` → eligió día y hora               → calendly_datetime_selected_at
--
-- `calendly.event_scheduled` NO se persiste acá: el webhook `invitee.created`
-- ya guarda `scheduled_at` (migración 2026_05_06_lead_quiz_calendly).
--
-- Embudo resultante: completó quiz → cargó Calendly → eligió slot → agendó.
-- Un gap grande entre "completó quiz" y "cargó Calendly" = el delay de carga
-- nos está costando leads.
--
-- Idempotente.
ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS calendly_loaded_at timestamptz;

ALTER TABLE public.lead_quiz_responses
  ADD COLUMN IF NOT EXISTS calendly_datetime_selected_at timestamptz;

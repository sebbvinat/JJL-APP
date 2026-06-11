-- Error-tracking interno: errores de la app (cliente y server) quedan
-- registrados acá para diagnosticarlos sin esperar a que un alumno se queje.
--
-- Solo escribe/lee el service_role (el endpoint /api/client-errors).
-- RLS habilitado SIN policies = anon/authenticated no pueden tocar la tabla.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  message text,
  stack text,
  url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS client_errors_created_at_idx
  ON public.client_errors (created_at DESC);

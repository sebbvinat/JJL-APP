-- app_config: key/value store para config en runtime (sin redeploy).
-- Por ahora: guardar el refresh token OAuth de Google Drive del admin que
-- conecta su cuenta (sebastianvinat@gmail.com), para que las subidas de
-- video queden a su nombre y usen su cuota personal en vez de la del
-- service account (que es 0 y causa 403 storage).

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users ON DELETE SET NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Solo admin lee/escribe (RLS). Service-role en el backend bypassea RLS.
CREATE POLICY "Admin can manage app_config" ON public.app_config
  FOR ALL USING (public.is_admin());

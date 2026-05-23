-- Anuncios: alertas globales que admin manda a todos los alumnos.
-- Aparecen como banner arriba de la app hasta que el usuario las cierra.

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  importancia TEXT DEFAULT 'info' CHECK (importancia IN ('info', 'warning', 'critical')),
  url TEXT,                                -- opcional, CTA del banner
  activa BOOLEAN DEFAULT TRUE,             -- admin la puede desactivar sin borrar
  created_by UUID REFERENCES public.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                   -- opcional, auto-baja despues de fecha
);

CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON public.announcements(activa, created_at DESC) WHERE activa = TRUE;

-- Marca por usuario de "ya lo cerre".
CREATE TABLE IF NOT EXISTS public.announcement_dismissals (
  announcement_id UUID REFERENCES public.announcements ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer anuncios activos; admin gestiona.
CREATE POLICY "Anyone can read announcements" ON public.announcements
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage announcements" ON public.announcements
  FOR ALL USING (public.is_admin());

-- Cada usuario gestiona sus dismissals.
CREATE POLICY "Users can read own dismissals" ON public.announcement_dismissals
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can dismiss own" ON public.announcement_dismissals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can undismiss own" ON public.announcement_dismissals
  FOR DELETE USING (user_id = auth.uid());

-- Competencias: calendario de torneos por alumno.
-- Cada fila es una competencia futura o pasada. La UI calcula countdown y
-- plan de preparacion en base a `fecha`.

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  lugar TEXT,
  categoria TEXT,           -- ej: adulto masculino azul medio pesado
  modalidad TEXT,           -- ej: gi / no-gi / ambos
  importancia TEXT DEFAULT 'normal' CHECK (importancia IN ('baja', 'normal', 'alta')),
  resultado TEXT,           -- texto libre post-evento
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_user_fecha
  ON public.competitions(user_id, fecha);

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own competitions" ON public.competitions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can manage own competitions" ON public.competitions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admin can manage all competitions" ON public.competitions
  FOR ALL USING (public.is_admin());

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

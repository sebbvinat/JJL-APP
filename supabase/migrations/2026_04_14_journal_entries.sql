-- Journal entries: each save from the diary creates a new row instead of
-- replacing a single text blob. Also lets standalone notes (without a fecha)
-- be added directly from the Biblioteca.

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('aprendizaje', 'observacion', 'nota')),
  text TEXT NOT NULL,
  fecha DATE,                             -- NULL = standalone note (no day)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- History reads: (user_id, created_at DESC). Daily reads: (user_id, fecha).
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created
  ON public.journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_fecha
  ON public.journal_entries(user_id, fecha)
  WHERE fecha IS NOT NULL;

-- Trigram search on text for fast ilike lookups in the library.
CREATE INDEX IF NOT EXISTS idx_journal_entries_text_trgm
  ON public.journal_entries USING gin (text gin_trgm_ops);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries" ON public.journal_entries
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can manage own entries" ON public.journal_entries
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- One-off backfill: split existing daily_tasks.{aprendizajes,observaciones,
-- notas} text blobs into rows. Safe to re-run — we only migrate rows that
-- haven't been migrated yet (detected by exact text match).
--
-- We don't NULL the original columns; the app will read from journal_entries
-- going forward and the old text fields are left as read-only legacy.
-- ---------------------------------------------------------------------------

INSERT INTO public.journal_entries (user_id, kind, text, fecha, created_at)
SELECT user_id, 'aprendizaje'::text, trim(aprendizajes), fecha, COALESCE(created_at, NOW())
FROM public.daily_tasks
WHERE aprendizajes IS NOT NULL AND trim(aprendizajes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.user_id = daily_tasks.user_id
      AND je.kind = 'aprendizaje'
      AND je.fecha = daily_tasks.fecha
      AND je.text = trim(daily_tasks.aprendizajes)
  );

INSERT INTO public.journal_entries (user_id, kind, text, fecha, created_at)
SELECT user_id, 'observacion'::text, trim(observaciones), fecha, COALESCE(created_at, NOW())
FROM public.daily_tasks
WHERE observaciones IS NOT NULL AND trim(observaciones) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.user_id = daily_tasks.user_id
      AND je.kind = 'observacion'
      AND je.fecha = daily_tasks.fecha
      AND je.text = trim(daily_tasks.observaciones)
  );

INSERT INTO public.journal_entries (user_id, kind, text, fecha, created_at)
SELECT user_id, 'nota'::text, trim(notas), fecha, COALESCE(created_at, NOW())
FROM public.daily_tasks
WHERE notas IS NOT NULL AND trim(notas) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.user_id = daily_tasks.user_id
      AND je.kind = 'nota'
      AND je.fecha = daily_tasks.fecha
      AND je.text = trim(daily_tasks.notas)
  );

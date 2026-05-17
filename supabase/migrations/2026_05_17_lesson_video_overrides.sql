-- Overrides de video por lección, independientes de course_data.
--
-- Problema: el editor de /admin/videos escribía solamente sobre las filas
-- course_data de cada alumno. Si no hay alumnos con ese módulo (o todavía
-- no se sincronizó post-deploy), el guardado no persistía en ningún lado y
-- al recargar el video desaparecía.
--
-- Solución: una tabla canónica (module_id, lesson_key) → youtube_id/titulo/
-- descripcion. El editor escribe SIEMPRE acá, y la lectura (course-data)
-- aplica estos overrides arriba de lo que venga de course_data o de la
-- planilla del código. Sobrevive a deploys y no depende de alumnos.

CREATE TABLE IF NOT EXISTS public.lesson_video_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  lesson_key TEXT NOT NULL,          -- titulo normalizado (lower, sin tildes)
  youtube_id TEXT,
  titulo TEXT,
  descripcion TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_video_overrides_uq UNIQUE (module_id, lesson_key)
);

ALTER TABLE public.lesson_video_overrides ENABLE ROW LEVEL SECURITY;

-- Sin policies: solo el service-role (server-side) puede leer/escribir.

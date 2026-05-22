-- ============================================
-- JJL CURSOS — cursos sueltos / instruccionales
-- ============================================
--
-- Producto separado del programa de 6 meses. Vive en el mismo código y
-- la misma base, servido en el dominio jiujitsulatino.com. Estas tablas
-- son independientes de modules/lessons/user_access/user_progress (que
-- pertenecen al programa). Namespace: cursos_*.
--
-- Modelo: curso -> secciones -> lecciones. Un bundle otorga acceso a N
-- cursos (al otorgarlo se expande a un grant por curso). El acceso tiene
-- vencimiento (NULL = de por vida). Reusa is_admin(), update_updated_at()
-- y el trigger handle_new_user() ya existentes en schema.sql.

-- ---------- C1. COURSES ----------
CREATE TABLE IF NOT EXISTS public.cursos_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descripcion TEXT,
  instructor TEXT,
  cover_url TEXT,
  trailer_youtube_id TEXT,
  precio INTEGER,
  precio_label TEXT,
  payment_url TEXT,
  sales_copy JSONB NOT NULL DEFAULT '{}'::jsonb,
  curriculum_preview JSONB NOT NULL DEFAULT '[]'::jsonb,  -- títulos para la página de venta (sin youtube_id)
  nivel TEXT,
  publicado BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  duracion_acceso_meses INTEGER,  -- NULL = de por vida
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- C2. BUNDLES ----------
CREATE TABLE IF NOT EXISTS public.cursos_bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descripcion TEXT,
  cover_url TEXT,
  precio INTEGER,
  precio_label TEXT,
  payment_url TEXT,
  sales_copy JSONB NOT NULL DEFAULT '{}'::jsonb,
  publicado BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  duracion_acceso_meses INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- C3. BUNDLE ITEMS ----------
CREATE TABLE IF NOT EXISTS public.cursos_bundle_items (
  bundle_id UUID REFERENCES public.cursos_bundles ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.cursos_courses ON DELETE CASCADE NOT NULL,
  orden INTEGER DEFAULT 0,
  PRIMARY KEY (bundle_id, course_id)
);

-- ---------- C4. SECTIONS (módulos) ----------
CREATE TABLE IF NOT EXISTS public.cursos_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.cursos_courses ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- C5. LESSONS (video o texto; cualquiera con material) ----------
CREATE TABLE IF NOT EXISTS public.cursos_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES public.cursos_sections ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.cursos_courses ON DELETE CASCADE NOT NULL,  -- denormalizado para checks de acceso
  tipo TEXT NOT NULL DEFAULT 'video' CHECK (tipo IN ('video', 'texto')),
  titulo TEXT NOT NULL,
  youtube_id TEXT,
  contenido TEXT,        -- cuerpo principal para tipo = 'texto'
  material JSONB,        -- "material de estudio" en texto enriquecido
  duracion TEXT,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- C6. ACCESS GRANTS ----------
CREATE TABLE IF NOT EXISTS public.cursos_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.cursos_courses ON DELETE CASCADE NOT NULL,
  source_bundle_id UUID REFERENCES public.cursos_bundles ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMPTZ,  -- NULL = de por vida
  revoked BOOLEAN DEFAULT FALSE,
  notas TEXT,
  UNIQUE (user_id, course_id)
);

-- ---------- C7. PROGRESS (mismo patrón que user_progress) ----------
CREATE TABLE IF NOT EXISTS public.cursos_progress (
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.cursos_lessons ON DELETE CASCADE NOT NULL,
  completado BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);

-- ---------- Índices ----------
CREATE INDEX IF NOT EXISTS idx_cursos_sections_course ON public.cursos_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_cursos_lessons_section ON public.cursos_lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_cursos_lessons_course  ON public.cursos_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_cursos_access_user     ON public.cursos_access(user_id);
CREATE INDEX IF NOT EXISTS idx_cursos_access_course   ON public.cursos_access(course_id);
CREATE INDEX IF NOT EXISTS idx_cursos_progress_user   ON public.cursos_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_cursos_bundle_items_b  ON public.cursos_bundle_items(bundle_id);

-- ---------- Triggers updated_at ----------
DROP TRIGGER IF EXISTS update_cursos_courses_updated_at ON public.cursos_courses;
CREATE TRIGGER update_cursos_courses_updated_at
  BEFORE UPDATE ON public.cursos_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_cursos_bundles_updated_at ON public.cursos_bundles;
CREATE TRIGGER update_cursos_bundles_updated_at
  BEFORE UPDATE ON public.cursos_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- RLS ----------
ALTER TABLE public.cursos_courses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_bundles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_lessons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_access       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos_progress     ENABLE ROW LEVEL SECURITY;

-- Lectura pública de cursos/bundles publicados (o todo si es admin)
DROP POLICY IF EXISTS "Anyone reads published courses" ON public.cursos_courses;
CREATE POLICY "Anyone reads published courses" ON public.cursos_courses
  FOR SELECT USING (publicado = true OR public.is_admin());

DROP POLICY IF EXISTS "Anyone reads published bundles" ON public.cursos_bundles;
CREATE POLICY "Anyone reads published bundles" ON public.cursos_bundles
  FOR SELECT USING (publicado = true OR public.is_admin());

DROP POLICY IF EXISTS "Anyone reads bundle items" ON public.cursos_bundle_items;
CREATE POLICY "Anyone reads bundle items" ON public.cursos_bundle_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone reads sections" ON public.cursos_sections;
CREATE POLICY "Anyone reads sections" ON public.cursos_sections
  FOR SELECT USING (true);

-- Lecciones: el youtube_id NO debe filtrarse. Solo admin o usuarios con
-- grant vigente. La página de venta usa cursos_courses.curriculum_preview.
DROP POLICY IF EXISTS "Lessons readable by entitled users" ON public.cursos_lessons;
CREATE POLICY "Lessons readable by entitled users" ON public.cursos_lessons
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.cursos_access a
      WHERE a.user_id = auth.uid()
        AND a.course_id = cursos_lessons.course_id
        AND a.revoked = false
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Users read own access" ON public.cursos_access;
CREATE POLICY "Users read own access" ON public.cursos_access
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admin manages access" ON public.cursos_access;
CREATE POLICY "Admin manages access" ON public.cursos_access
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users read own cursos progress" ON public.cursos_progress;
CREATE POLICY "Users read own cursos progress" ON public.cursos_progress
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own cursos progress" ON public.cursos_progress;
CREATE POLICY "Users insert own cursos progress" ON public.cursos_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own cursos progress" ON public.cursos_progress;
CREATE POLICY "Users update own cursos progress" ON public.cursos_progress
  FOR UPDATE USING (user_id = auth.uid());

-- Escritura solo admin
DROP POLICY IF EXISTS "Admin manages courses" ON public.cursos_courses;
CREATE POLICY "Admin manages courses" ON public.cursos_courses
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manages bundles" ON public.cursos_bundles;
CREATE POLICY "Admin manages bundles" ON public.cursos_bundles
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manages bundle items" ON public.cursos_bundle_items;
CREATE POLICY "Admin manages bundle items" ON public.cursos_bundle_items
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manages sections" ON public.cursos_sections;
CREATE POLICY "Admin manages sections" ON public.cursos_sections
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manages lessons" ON public.cursos_lessons;
CREATE POLICY "Admin manages lessons" ON public.cursos_lessons
  FOR ALL USING (public.is_admin());

-- ---------- Extender users.rol con 'cliente_cursos' ----------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_rol_check;
ALTER TABLE public.users ADD CONSTRAINT users_rol_check
  CHECK (rol IN ('admin', 'alumno', 'cliente_cursos'));

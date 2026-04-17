-- ============================================
-- JIU JITSU LATINO — Database Schema
-- ============================================

-- 1. USERS (extiende auth.users de Supabase)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  cinturon_actual TEXT DEFAULT 'white' CHECK (cinturon_actual IN ('white', 'blue', 'purple', 'brown', 'black')),
  puntos INTEGER DEFAULT 0,
  rol TEXT DEFAULT 'alumno' CHECK (rol IN ('admin', 'alumno')),
  avatar_url TEXT,
  planilla_id TEXT,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  onboarding_step INTEGER DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MODULES (semanas del programa 1-24)
CREATE TABLE public.modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_numero INTEGER NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LESSONS (videos dentro de cada modulo)
CREATE TABLE public.lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES public.modules ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  duracion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USER_PROGRESS (tracking de lecciones completadas)
CREATE TABLE public.user_progress (
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons ON DELETE CASCADE NOT NULL,
  completado BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);

-- 5. USER_ACCESS (candado por modulo — admin controla)
CREATE TABLE public.user_access (
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.modules ON DELETE CASCADE NOT NULL,
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, module_id)
);

-- 6. DAILY_TASKS (diario de entrenamiento — persistente y revisable)
CREATE TABLE public.daily_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,

  -- Check-in del dia (metricas cuantitativas)
  entreno_check BOOLEAN DEFAULT FALSE,
  fatiga TEXT CHECK (fatiga IN ('verde', 'amarillo', 'rojo')),
  intensidad TEXT CHECK (intensidad IN ('baja', 'media', 'alta')),
  puntaje INTEGER CHECK (puntaje >= 1 AND puntaje <= 10),

  -- Foco semanal (se edita cualquier dia; la UI lo muestra por semana ISO)
  objetivo TEXT,                 -- Que voy a practicar en la lucha
  objetivo_cumplido BOOLEAN,
  regla TEXT,                    -- Que NO voy a hacer
  regla_cumplida BOOLEAN,

  -- Meta de entrenamiento de mayor duracion (revisable)
  meta_entreno TEXT,             -- Que quiero entrenar (semanas/meses)

  -- Reflexion post-entreno (persistente, searchable)
  aprendizajes TEXT,             -- Que aprendiste de tus luchas hoy
  observaciones TEXT,            -- Notas del dia, problemas, logros
  notas TEXT,                    -- Notas libres con links (recursos, ideas)

  feedback_texto TEXT,           -- (legacy: feedback semanal via TaskDashboard)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fecha)
);

-- 7. POSTS (comunidad/foro)
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  categoria TEXT DEFAULT 'discussion' CHECK (categoria IN ('question', 'technique', 'progress', 'discussion', 'competition', 'bienvenida', 'offtopic')),
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. COMMENTS (comentarios en posts)
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  contenido TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. LIKES (sistema de likes para posts y comments)
CREATE TABLE public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id)
);

-- 10. VIDEO_UPLOADS (registro de videos subidos a Drive + loop de revision)
CREATE TABLE public.video_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  tags TEXT[],
  file_size BIGINT,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'revisado', 'para_rehacer')),
  feedback_texto TEXT,
  feedback_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. NOTIFICATIONS (sistema de notificaciones)
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('belt', 'module', 'streak', 'achievement', 'system')),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  url TEXT,
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. EVENTS (calendario de eventos)
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL,
  duracion_min INTEGER DEFAULT 60,
  timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  meet_link TEXT,
  recurrencia TEXT CHECK (recurrencia IN ('none', 'weekly', 'biweekly', 'monthly')),
  recurrencia_fin DATE,
  parent_event_id UUID REFERENCES public.events ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. EVENT_RSVPS (confirmaciones de asistencia)
CREATE TABLE public.event_rsvps (
  event_id UUID REFERENCES public.events ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- 14. USER_SESSIONS (tiempo en la app)
CREATE TABLE public.user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER DEFAULT 0,
  pages_viewed INTEGER DEFAULT 0
);

-- 15. MESSAGES (chat directo)
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  contenido TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. PUSH_SUBSCRIPTIONS (Web Push subscriptions)
CREATE TABLE public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- 14. COMPETITIONS (calendario de torneos por alumno)
CREATE TABLE public.competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  lugar TEXT,
  categoria TEXT,
  modalidad TEXT,
  importancia TEXT DEFAULT 'normal' CHECK (importancia IN ('baja', 'normal', 'alta')),
  resultado TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. COURSE_DATA (curriculum personalizado por usuario)
-- Cada fila es una semana/modulo asignado a un usuario, con sus lecciones
-- como JSONB. module_id es TEXT (IDs provenientes de planillas.ts / mock-data.ts),
-- NO una FK a public.modules.
CREATE TABLE public.course_data (
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  module_id TEXT NOT NULL,
  semana_numero INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, module_id)
);

-- ============================================
-- INDICES
-- ============================================
CREATE INDEX idx_lessons_module ON public.lessons(module_id);
CREATE INDEX idx_user_progress_user ON public.user_progress(user_id);
CREATE INDEX idx_user_access_user ON public.user_access(user_id);
CREATE INDEX idx_daily_tasks_user_fecha ON public.daily_tasks(user_id, fecha);
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_comments_post ON public.comments(post_id);
CREATE INDEX idx_video_uploads_user ON public.video_uploads(user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE leido = FALSE;
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, started_at DESC);
CREATE INDEX idx_messages_to ON public.messages(to_user_id, created_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages(from_user_id, to_user_id);
CREATE INDEX idx_events_fecha ON public.events(fecha_hora);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_event_rsvps_user ON public.event_rsvps(user_id);
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX idx_course_data_user ON public.course_data(user_id);
CREATE INDEX idx_users_onboarding_pending ON public.users(id) WHERE onboarding_completed_at IS NULL;
CREATE INDEX idx_course_data_user_semana ON public.course_data(user_id, semana_numero);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_data ENABLE ROW LEVEL SECURITY;

-- Helper: verificar si el usuario es admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- USERS policies
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admin can update any user" ON public.users
  FOR UPDATE USING (public.is_admin());

-- MODULES policies (todos pueden leer)
CREATE POLICY "Anyone can read modules" ON public.modules
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage modules" ON public.modules
  FOR ALL USING (public.is_admin());

-- LESSONS policies (todos pueden leer)
CREATE POLICY "Anyone can read lessons" ON public.lessons
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage lessons" ON public.lessons
  FOR ALL USING (public.is_admin());

-- USER_PROGRESS policies
CREATE POLICY "Users can read own progress" ON public.user_progress
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own progress" ON public.user_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can modify own progress" ON public.user_progress
  FOR UPDATE USING (user_id = auth.uid());

-- USER_ACCESS policies
CREATE POLICY "Users can read own access" ON public.user_access
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admin can manage access" ON public.user_access
  FOR ALL USING (public.is_admin());

-- DAILY_TASKS policies
CREATE POLICY "Users can read own tasks" ON public.daily_tasks
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own tasks" ON public.daily_tasks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks" ON public.daily_tasks
  FOR UPDATE USING (user_id = auth.uid());

-- POSTS policies (todos pueden leer, autores pueden escribir)
CREATE POLICY "Anyone can read posts" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create posts" ON public.posts
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own posts" ON public.posts
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Authors or admin can delete posts" ON public.posts
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

-- COMMENTS policies
CREATE POLICY "Anyone can read comments" ON public.comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete own comments" ON public.comments
  FOR DELETE USING (author_id = auth.uid() OR public.is_admin());

-- LIKES policies
CREATE POLICY "Anyone can read likes" ON public.likes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own likes" ON public.likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes" ON public.likes
  FOR DELETE USING (user_id = auth.uid());

-- VIDEO_UPLOADS policies
CREATE POLICY "Users can read own uploads" ON public.video_uploads
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own uploads" ON public.video_uploads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS policies
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Notifications are inserted by server-side code using service_role key
-- Regular users can only read/update their own
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- USER_SESSIONS policies
CREATE POLICY "Users can insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can read all sessions" ON public.user_sessions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- MESSAGES policies
CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "Users can mark own messages read" ON public.messages
  FOR UPDATE USING (to_user_id = auth.uid());

-- EVENTS policies
CREATE POLICY "Anyone can read events" ON public.events
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage events" ON public.events
  FOR ALL USING (public.is_admin());

-- EVENT_RSVPS policies
CREATE POLICY "Anyone can read rsvps" ON public.event_rsvps
  FOR SELECT USING (true);
CREATE POLICY "Users can manage own rsvp" ON public.event_rsvps
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admin can manage rsvps" ON public.event_rsvps
  FOR ALL USING (public.is_admin());

-- PUSH_SUBSCRIPTIONS policies
CREATE POLICY "Users can manage own push subs" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Push subs read by service_role key only (server-side sends push)
CREATE POLICY "Admins can read push subs" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- COURSE_DATA policies
CREATE POLICY "Users can read own course data" ON public.course_data
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admin can manage course data" ON public.course_data
  FOR ALL USING (public.is_admin());

CREATE TRIGGER update_course_data_updated_at
  BEFORE UPDATE ON public.course_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- TRIGGER: auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'name', 'Usuario'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

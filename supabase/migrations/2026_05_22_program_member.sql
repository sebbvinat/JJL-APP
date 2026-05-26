-- Separación estricta entre alumnos del programa (jjl-app / alumno.jiujitsulatino)
-- y compradores de cursos sueltos (jiujitsulatino.com / /cursos). Antes
-- compartían users table sin distinción y aparecían todos en los dropdowns
-- de admin + cualquiera con cuenta podía entrar al dashboard.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS program_member BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_program_member
  ON public.users(program_member) WHERE program_member = TRUE;

-- Backfill: marcar TRUE a quienes ya son alumnos / admins reales.
-- Heurística: admin, o tienen planilla, o tienen acceso a algún módulo,
-- o han subido algún video.
UPDATE public.users
  SET program_member = TRUE
WHERE rol = 'admin'
   OR planilla_id IS NOT NULL
   OR id IN (SELECT DISTINCT user_id FROM public.user_access)
   OR id IN (SELECT DISTINCT user_id FROM public.video_uploads);

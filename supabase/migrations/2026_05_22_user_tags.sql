-- Tags por usuario (principalmente para sub-roles de admins: soporte,
-- profesor, setter). Array vacio por default. Index GIN para queries
-- por contiene-tag rapidas.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_tags
  ON public.users USING GIN (tags);

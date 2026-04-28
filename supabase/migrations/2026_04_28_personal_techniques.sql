-- Personal techniques + saved links (myBJJ-style "My Moves" + "Try Later")
-- Each user owns a private collection of techniques (with steps + photos)
-- and a separate list of saved links (Instagram/TikTok/YouTube to try later).

-- ---------------------------------------------------------------------------
-- personal_techniques: el alumno arma su propio repertorio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_techniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'otro',
  notas TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ orden, texto, photo_url? }]
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ url, caption? }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pt_user_topic
  ON public.personal_techniques (user_id, topic);

CREATE INDEX IF NOT EXISTS idx_pt_user_created
  ON public.personal_techniques (user_id, created_at DESC);

ALTER TABLE public.personal_techniques ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "personal_techniques_owner_all" ON public.personal_techniques
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin read-only (uses users.rol)
CREATE POLICY "personal_techniques_admin_select" ON public.personal_techniques
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.rol = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- saved_links: cosas que vio en redes y quiere probar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source TEXT,                        -- 'instagram' | 'tiktok' | 'youtube' | 'other'
  titulo TEXT,
  notas TEXT,
  thumbnail_url TEXT,
  topic TEXT NOT NULL DEFAULT 'otro',
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'tried'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_user_status
  ON public.saved_links (user_id, status);

ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_links_owner_all" ON public.saved_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_links_admin_select" ON public.saved_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.rol = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for technique photos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('technique-photos', 'technique-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Public read; only owner can write/delete (object name prefix = user_id/...)
CREATE POLICY "technique_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'technique-photos');

CREATE POLICY "technique_photos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'technique-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "technique_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'technique-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

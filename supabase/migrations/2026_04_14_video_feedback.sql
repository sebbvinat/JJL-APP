-- Video feedback loop: alumno sube → coach revisa → alumno ve nota.
-- Extiende video_uploads con estado, feedback textual y marca de revision.

ALTER TABLE public.video_uploads
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'revisado', 'para_rehacer')),
  ADD COLUMN IF NOT EXISTS feedback_texto   TEXT,
  ADD COLUMN IF NOT EXISTS feedback_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_video_uploads_status
  ON public.video_uploads(status, created_at DESC);

-- Admin needs to update feedback on any student's upload.
-- The existing 'Users can insert own uploads' policy stays; add an admin
-- UPDATE policy. Supabase SELECT policy already allows admin to read.
CREATE POLICY "Admin can review uploads" ON public.video_uploads
  FOR UPDATE USING (public.is_admin());

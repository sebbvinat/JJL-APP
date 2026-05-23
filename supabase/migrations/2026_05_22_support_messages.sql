-- Soporte: chat alumno <-> "Soporte" (todos los admin, anonimo).
-- El alumno ve "Soporte" (no el nombre del admin). Internamente guardamos
-- sender_user_id para auditoria de quien respondio.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- el alumno duenio del hilo (todos los mensajes de un thread comparten user_id)
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  -- 'user' = mensaje del alumno; 'admin' = respuesta de un admin (se muestra como "Soporte")
  sender TEXT NOT NULL CHECK (sender IN ('user', 'admin')),
  -- quien escribio realmente (para auditoria); SET NULL si se borra el user
  sender_user_id UUID REFERENCES public.users ON DELETE SET NULL,
  contenido TEXT NOT NULL,
  -- leido por el destinatario: si sender='user' lo marca un admin; si sender='admin' lo marca el alumno
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user
  ON public.support_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread_from_user
  ON public.support_messages(user_id) WHERE sender = 'user' AND leido = FALSE;
CREATE INDEX IF NOT EXISTS idx_support_messages_unread_from_admin
  ON public.support_messages(user_id) WHERE sender = 'admin' AND leido = FALSE;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Alumno: lee su propio hilo, envia con sender='user', marca como leido.
CREATE POLICY "Users can read own support thread" ON public.support_messages
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can send to own thread" ON public.support_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND sender = 'user' AND sender_user_id = auth.uid()
  );

CREATE POLICY "Users can mark own thread read" ON public.support_messages
  FOR UPDATE USING (user_id = auth.uid());

-- Admin: acceso total (en la app respondemos via service-role igual).
CREATE POLICY "Admin can manage all support" ON public.support_messages
  FOR ALL USING (public.is_admin());

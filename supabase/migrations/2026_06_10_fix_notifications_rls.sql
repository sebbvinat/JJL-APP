-- Seguridad: cerrar la inserción de notificaciones desde el cliente.
--
-- La policy original permitía que CUALQUIER usuario autenticado insertara
-- una notificación para CUALQUIER user_id:
--
--   CREATE POLICY "Service role can insert notifications" ON notifications
--     FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
--
-- Como existe un browser client con la anon key, un alumno podía hacer
--   supabase.from('notifications').insert({ user_id: <víctima>, ... })
-- y spamear/suplantar notificaciones del sistema a otros usuarios.
--
-- Las notificaciones legítimas SIEMPRE se crean server-side con el
-- service_role key (lib/notifications.ts → createNotification), que
-- BYPASEA RLS. Por lo tanto no hace falta ninguna policy de INSERT para el
-- cliente: la quitamos por completo. El service_role sigue funcionando.
--
-- Idempotente: DROP IF EXISTS.

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- (No recreamos ninguna policy de INSERT: sin policy, los clientes anon/
--  authenticated NO pueden insertar; el service_role no la necesita.)

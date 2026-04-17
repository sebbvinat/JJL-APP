# JJL App - Jiu Jitsu Latino

## Proyecto
- **Tipo**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Video**: YouTube IFrame API con controles custom
- **Storage**: Google Drive (videos de alumnos), Supabase Storage (avatars)
- **Deploy**: Vercel (auto-deploy desde GitHub)
- **Repo**: github.com/sebbvinat/JJL-APP.git
- **Path**: C:/Users/sebas/Desktop/jjl-app

## Stack
- Next.js 16.2.3, React 19.2.4, TypeScript
- Supabase SSR + Service Role para admin ops
- web-push para notificaciones push (VAPID)
- date-fns para fechas, lucide-react para iconos
- clsx para clases CSS

## Estructura de archivos clave
- `src/app/(dashboard)/` - rutas de usuario (dashboard, modules, journal, community, upload, profile)
- `src/app/(admin)/admin/` - panel admin (page.tsx = lista alumnos, [userId] = detalle alumno, courses = planillas, edit/[moduleId] = editor de modulo)
- `src/app/api/` - endpoints API (daily-task, dashboard-stats, progress, notifications, push, community, admin/*)
- `src/components/` - componentes (video/CustomVideoPlayer, layout/Topbar+Sidebar+MobileNav+NotificationBell, ui/*, gamification/*, dashboard/*)
- `src/providers/UserProvider.tsx` - context compartido de auth/user
- `src/lib/` - utilidades (gamification.ts, notifications.ts, planillas.ts, constants.ts, course-data.ts, google-drive.ts)
- `supabase/schema.sql` - schema completo de la DB
- `public/sw.js` - service worker (cache + push notifications)

## Base de datos (Supabase)
### Tablas
- `users` - id, nombre, email, cinturon_actual, puntos, rol, avatar_url, planilla_id
- `modules` - id, semana_numero, titulo, descripcion
- `lessons` - id, module_id, titulo, youtube_id, descripcion, orden, duracion
- `user_progress` - user_id, lesson_id, completado, completed_at
- `user_access` - user_id, module_id, is_unlocked
- `daily_tasks` - user_id, fecha, entreno_check, fatiga, intensidad, objetivo, objetivo_cumplido, regla, regla_cumplida, puntaje, observaciones, feedback_texto
- `posts` - author_id, titulo, contenido, categoria, likes_count
- `comments` - post_id, author_id, contenido, likes_count
- `likes` - user_id, post_id/comment_id
- `video_uploads` - user_id, titulo, drive_file_id, drive_url
- `notifications` - user_id, tipo, titulo, mensaje, leido
- `push_subscriptions` - user_id, endpoint, keys_p256dh, keys_auth
- `events` - created_by, titulo, descripcion, fecha_hora, duracion_min, timezone, meet_link, recurrencia
- `event_rsvps` - event_id, user_id, status (pending/confirmed/declined)
- `user_sessions` - user_id, started_at, duration_seconds, pages_viewed
- `messages` - from_user_id, to_user_id, contenido, leido

### Views
- `course_data` - view que une modules+lessons+user_access por usuario (user_id, module_id, semana_numero, titulo, lessons JSON array)

## Planillas de curso
4 programas de 6 meses (Fundamentos + 24 semanas):
- **Livianos**: Leg Trap, Stack Pass, Gola Manga, Cross Grip
- **Medios**: Pasaje DLR, Cross Grip, Guardia X
- **Simbio**: Reverse DLR, 1/2 Guardia, Over Under, Butterfly, Dog Fight
- **Atleticos**: Leg Trap, Cross Grip, Gola Manga

Todos comparten: Fundamentos + Mes 1 (Guardia Cerrada + Toreos) + Mes 2 (100KG, Kimura, Armbar, Escape)

## Sistema de cinturones
- White (inicio) → Blue (semana 4) → Purple (semana 8) → Brown (semana 16) → Black (semana 24)
- Puntos: 10/leccion + 5/dia entrenado + 50/semana completa
- Admin siempre = cinturon negro
- Belt nunca baja, solo sube (max entre DB y calculado)

## Features implementadas
- Video player custom con fullscreen CSS (iOS) y nativo (Android con landscape lock)
- Diario de entrenamiento (/journal) con fatiga, intensidad, objetivo, regla, puntaje
- Sistema de notificaciones in-app (campanita) + Web Push
- Avatar upload a Supabase Storage
- Auto-update via service worker (check cada 60s, reload automatico)
- Admin: crear/editar/eliminar usuarios, gestionar cinturon/rol/password
- Comunidad: posts, comments, likes, categorias (incluyendo Off Topic)
- Pre-fill YouTube ID al agregar leccion nueva en editor
- Eventos con RSVP, recurrencia, Zoom/Meet link, email reminders (Resend)
- Admin analytics: retencion, engagement, tiempo en app, grafico DAU
- Session tracking: tiempo por sesion, paginas vistas
- Chat DM: mensajes directos alumno ↔ instructor con push
- Sincronizar planillas: boton que actualiza videos a todos los alumnos
- Carpeta Drive por alumno para subir videos grandes

## Variables de entorno (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GOOGLE_SERVICE_ACCOUNT_KEY (JSON del service account)
- GOOGLE_DRIVE_FOLDER_ID
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- RESEND_API_KEY (para email reminders de eventos)
- CRON_SECRET (opcional, para proteger endpoints de cron)

## Notas importantes
- El logo es negro con fondo transparente → necesita circulo blanco detras
- iOS Safari NO soporta Fullscreen API para iframes → se usa CSS fullscreen
- La view `course_data` en Supabase genera los lesson IDs que se guardan en user_progress
- El UserProvider carga el profile una sola vez → para avatar actualizado, fetchear directo de DB
- Service worker cache version actual: v3
- Categorias de comunidad: question, technique, progress, discussion, competition, offtopic
- Chat DM: polling cada 5s, push notification al recibir mensaje
- Session tracker: guarda duracion cada 30s + sendBeacon al cerrar
- Vercel Cron: /api/events/remind cada hora para email reminders 24h antes
- Resend email template: HTML styled con colores JJL

# JJL App — Jiu Jitsu Latino

Última revisión de este archivo: 20/9/2026, contra el commit `2844835` (el que sigue en
producción: `/api/version` devolvió `2844835f` ese día), contra el árbol de trabajo (que tiene
la v2 sin commitear, ver sección 13) y contra la base de producción (consultas de solo lectura).
Todo lo que dice acá se miró en el código o en la base ese día. Si algo no te coincide,
creele al código y corregí este archivo: un CLAUDE.md viejo ya hizo perder tiempo a varios
agentes (decía "cache v3" y listaba tablas que no existen).

Leé también `AGENTS.md`: avisa que este Next.js (16) no es el que conocés y que hay que
mirar `node_modules/next/dist/docs/` antes de escribir código de framework.

---

## 1. Qué es

Un solo proyecto Next.js, un solo deploy en Vercel, **dos productos** separados por dominio
(`src/lib/hosts.ts` + `src/lib/supabase/middleware.ts`):

| Producto | Dominio | Qué es | Dónde vive |
|---|---|---|---|
| **Alumno** | `alumno.jiujitsulatino.com` | El programa de 6 meses: curso, diario, comunidad, chat, panel de admin y panel del setter. También sirve las landings del embudo de ventas. | `src/app/(dashboard)`, `src/app/(admin)`, `src/app/(auth)`, y las landings sueltas en `src/app/` |
| **Cursos** | `jiujitsulatino.com` y `www.` | Tienda de cursos sueltos (instruccionales) con pago por Stripe. | `src/app/(cursos)/cursos/...` — en el dominio real la URL es limpia y el middleware reescribe a `/cursos/*`; en localhost se entra con el prefijo `/cursos` |

Hosts desconocidos (previews `*.vercel.app`, `localhost`) caen en "alumno". `NEXT_PUBLIC_SITE`
fuerza un sitio en desarrollo y **no** debe estar seteada en producción.

Ojo: `jjl-app` no es `jjl-manager`. `jjl-manager` (FastAPI, contenido y marketing) es otro repo.

- Repo: `github.com/sebbvinat/JJL-APP` · rama `main` · carpeta `C:\claude-projects\jjl-app`
- **Cada push a `main` despliega a producción.** No hay staging.

## 2. Stack real (de `package.json`)

- Next.js 16.2.3 (App Router) · React 19.2.4 · TypeScript 5 (strict) · Tailwind CSS 4
- Supabase: `@supabase/ssr` + `@supabase/supabase-js` (Postgres, Auth, Storage). Buckets en uso: `avatars`, `technique-photos`
- `swr` (fetch en cliente), `date-fns`, `lucide-react`, `clsx`
- `web-push` (notificaciones push, VAPID) · `resend` (mails) · `googleapis` (Drive, Sheets, YouTube)
- Stripe **sin SDK**: el webhook de cursos verifica la firma y llama a la API con `fetch`
- Dev: `eslint` 9 + `eslint-config-next`, `tsx` (para correr scripts `.ts`), `sharp`
- No hay tests unitarios ni framework de tests instalado.

Scripts de `package.json`: `dev`, `build` (**no correr, ver Reglas 9**), `start`, `lint`.
En curso (v2): `typecheck` (`tsc --noEmit`) y `lint:ci` (`eslint src --max-warnings=200`) están en el
`package.json` del árbol de trabajo, sin commitear al 20/9; fijate si ya están en `main`.

## 3. Mapa del código

```
src/middleware.ts                → entra a updateSession() en cada request (páginas Y /api)
src/lib/supabase/middleware.ts   → ruteo por dominio + permisos (ZONA SENSIBLE)
src/lib/supabase/server.ts       → clientes de Supabase del server y requireAdmin() (ZONA SENSIBLE)
src/lib/permisos-setter.ts       → en curso (v2): lista blanca del setter, función pura (ZONA SENSIBLE)
src/lib/rate-limit.ts            → en curso (v2): tope por IP de los endpoints públicos; falla abierto
src/lib/session-id.ts            → en curso (v2): valida/convierte el session_id del embudo a UUID
src/lib/hosts.ts                 → qué dominio es qué producto
src/lib/cron.ts                  → requireCron(): auth de todos los crons
src/lib/logger.ts                → logger único; en el browser manda los errores a /api/client-errors
src/lib/lead-webhook.ts          → reenvío de eventos del embudo a Make (ZONA SENSIBLE)
src/lib/lead-labels.ts           → etiquetas legibles de los valores del quiz
src/lib/lead-notifications.ts    → avisos al setter (in-app + push)
src/lib/whatsapp.ts              → WhatsApp al coach vía CallMeBot
src/lib/calendly.ts / calendly-url.ts → lectura de agendas por API / armado del link con utm_content y a4
src/lib/crm.ts                   → mes, progreso y elegibilidad 1-a-1 de cada alumno
src/lib/crm-ventas.ts / crm-logs.ts   → lectura de la planilla del CRM (Google Sheets, solo lectura)
src/lib/alta-alumno.ts           → alta de alumno (desde un lead o desde una consultoría de Calendly)
src/lib/planillas.ts             → las 4 planillas del curso (livianos, medios, simbio, atleticos)
src/lib/admin-videos.ts          → normTitle() y el mapeo semana → mes
src/lib/gamification.ts + constants.ts → cinturones y puntos
src/lib/cursos/*                 → acceso, catálogo y queries de la tienda de cursos
src/providers/UserProvider.tsx   → contexto del usuario (Alumno); CursosUserProvider.tsx (Cursos)
src/components/VersionCheck.tsx  → detecta un deploy nuevo consultando /api/version
src/components/ErrorReporter.tsx, SessionTracker.tsx, PushPrompt.tsx, AnnouncementsBar.tsx
public/sw.js                     → service worker (ZONA SENSIBLE; lo reescribe el build)
scripts/build-sw.mjs             → en el build pone CACHE_NAME = 'jjl-<sha8>' en public/sw.js
scripts/check-schema.mjs         → patrón para leer .env.local y consultar la base sin imprimir claves
scripts/check-permisos.ts        → en curso (v2): compara la lista blanca del setter con los allowSetter
                                   de las rutas reales. `npx tsx scripts/check-permisos.ts` → "OK". No toca base ni red.
scripts/embudo-check.mjs         → en curso (v2): números del embudo, solo lectura
scripts/diagnostico-mes2.mjs     → en curso (v2): quién tiene el Mes 2 con el orden viejo, solo lectura
scripts/recuperar-handles.mjs    → en curso (v2): ESCRIBE datos; --dry por default, no aplicar sin Sebastián
supabase/schema.sql              → esquema base (viejo; NO es la foto de producción)
supabase/migrations/             → migraciones con fecha (ver sección 9)
docs/plan-v2.md                  → plan de la v2 y fichas de cada paquete (WP-01 a WP-11)
docs/looker.md                   → en curso (v2): cómo conectar Looker Studio a las vistas v_* y en qué orden
                                   correr las dos migraciones de vistas (seguidas: la segunda les saca el permiso a anon)
.github/workflows/ci.yml         → en curso (v2): tipos + lint en cada push. Avisa, NO bloquea el deploy
vercel.json                      → headers de seguridad + crons declarados (NO tocar, ver sección 6)
```

`scripts/` está lleno de one-offs de mayo/junio (cargas de YouTube IDs, backups JSON). No son
herramientas: no los corras. `migration/` son los scripts de la migración de clientes de
cursos; tiene datos personales y está en `.gitignore`.

## 4. Pantallas

**Públicas (sin login)** — lista `publicRoutes` del middleware: `/` (landing), `/login`, `/register`,
`/consultoria-gratuita` (formulario largo + Calendly), `/agendar` (agenda rápida, 3 preguntas),
`/que-luchador-sos` (quiz de arquetipo), `/auditoria`, `/auth/*`, `/r/[slug]` (links cortos con
conteo de clics: `tracked_links` → `link_clicks`). `/offline` es la pantalla que el service worker
guarda para cuando no hay red; no está en `publicRoutes`.

**Alumno** (`src/app/(dashboard)`): `/dashboard`, `/modules`, `/modules/[moduleId]`, `/journal`,
`/weekly`, `/maquina-tiempo`, `/library`, `/library/save`, `/community`, `/community/[postId]`,
`/chat`, `/soporte`, `/events`, `/competitions`, `/leaderboard`, `/members/[memberId]`, `/upload`,
`/profile`, `/onboarding`. Fuera del grupo: `/bienvenida` (onboarding obligatorio: el middleware
manda ahí hasta que `users.onboarding_completed_at` tenga valor) y `/exportar/diario`.

**Admin** (`src/app/(admin)/admin`): `/admin` (alumnos), `/admin/[userId]`, `/admin/agendas`
(Kanban del setter), `/admin/analytics`, `/admin/anuncios`, `/admin/courses`, `/admin/diaries`,
`/admin/edit/[moduleId]`, `/admin/google-drive`, `/admin/reviews`, `/admin/soporte`, `/admin/tags`,
`/admin/videos`, `/admin/youtube-import`.

**Cursos** (`src/app/(cursos)/cursos`): tienda `/`, `/curso/[slug]`, `/pack/[slug]`, `/login`,
`/mis-cursos`, `/cuenta`, `/privacidad`, `/auth/confirm`, `/auth/set-password`, reproductor
`/ver/[slug]`, y admin `/admin-cursos`, `/admin-cursos/curso/[id]`, `/admin-cursos/accesos`.

## 5. Roles, marcas (tags) y permisos

**Roles** (`users.rol`, constraint en `2026_05_22_cursos.sql`): `admin`, `alumno`, `cliente_cursos`.
Al 20/9 en producción: 3 admin, 43 alumno, 96 cliente_cursos.

**Marcas** (`users.tags`, `text[]`; las válidas están en `ALLOWED_TAGS` de
`src/app/api/admin/tags/route.ts`). Sirven para decidir a quién le llega cada aviso
(`getAdminsByTag` en `src/lib/admin-tags.ts`; si nadie tiene la marca, cae en todos los admins):

| Marca | Para qué |
|---|---|
| `setter` | Opera `/admin/agendas`. Recibe los avisos de leads. **Puede ser admin o una alumna** que usa la app con su cuenta. |
| `profesor` | Recibe los videos a revisar. |
| `soporte` | Recibe las consultas de soporte y el aviso de alumno listo para 1-a-1. |
| `errores` | Recibe el aviso "Errores en la app" (`/api/client-errors`). |

Otros campos de `users` que deciden acceso: `program_member` (pagó el programa),
`onboarding_completed_at`, `lifecycle_stage` (`prospect`, `onboarding`, `active`, `at_risk`,
`paused`, `churned`), `planilla_id`.

**Cómo se aplican los permisos (dos capas):**

1. **Middleware** (`src/lib/supabase/middleware.ts`), host Alumno:
   - Sin sesión → `/login`, salvo rutas públicas.
   - `cliente_cursos` y "alumno fantasma" (`rol='alumno'`, `program_member=false`, onboarding completo)
     → fuera del programa: las páginas redirigen a `jiujitsulatino.com/mis-cursos` y las `/api/*` dan 403.
     **Excepción a propósito:** `/api/leads/*` y `/api/track-click` no pasan por ese gate, porque un
     cliente de cursos logueado puede venir de un anuncio y llenar el formulario.
   - `/admin/*` solo para `rol='admin'`; una alumna con marca `setter` entra **solo** a `/admin/agendas`.
   - **Lista blanca del setter** (deny-by-default): con la marca `setter`, de `/api/admin/*` solo
     responde `/api/admin/leads/*`, `/api/admin/setter/*` y `GET /api/admin/tags`. El `PATCH` de tags
     está cerrado a propósito: si no, el setter se saca la marca y queda admin pleno.
2. **`requireAdmin(request, opts)`** en `src/lib/supabase/server.ts`: segunda capa dentro de cada ruta.
   `allowSetter: true` deja pasar a quien tenga la marca aunque no sea admin (solo lo usan las rutas
   de la lista blanca); `denyTags` rechaza marcas puntuales.

**Ojo: lo de arriba describe el árbol de trabajo del 20/9, no producción.** Agujero conocido (D1 del plan):
en el commit `2844835` (producción) la lista blanca del setter solo se aplica en el host Alumno; en el host
Cursos todo `/api/*` pasa sin gate, `requireAdmin()` sin opciones deja pasar a un setter con `rol='admin'`, y
varias rutas de admin hacen la auth a mano mirando solo `rol==='admin'`.

El arreglo, en curso (v2, WP-01), está escrito y **sin commitear** al 20/9:
- `src/lib/permisos-setter.ts` (`esApiDeAdmin`, `setterPuedeUsar`): función pura, sin Next ni Supabase, que el
  middleware usa **en los dos hosts**. Decodifica el percent-encoding (`/api/%61dmin/...`), cierra los `..`, y
  del setter solo deja pasar: `/api/admin/leads`, `/api/admin/leads/[id]` y `sales-summary`, las sub-rutas
  `contacts`, `convert` y `mark-sale` de un lead, todo `/api/admin/setter/*` y `GET /api/admin/tags`.
  `commission-monthly` está nombrada como retirada para que, si alguien la revive, nazca cerrada.
- `src/lib/supabase/server.ts`: `requireAdmin` rechaza la marca `setter` por defecto; `verificarAdmin` es lo
  mismo pero devuelve 401/403 con motivo, para las rutas que hacían auth a mano.
- Ya pasadas a `verificarAdmin`: `analytics`, `announcements` (y `[id]`), `import-drive-video`,
  `link-drive-folder`, `soporte` (y `[userId]`), `student-diary`, `sync-planillas`.
- Siguen con chequeo a mano de `rol` (mirado el 20/9): el `POST` manual de `sync-drive-videos`, los callbacks
  `google-oauth/callback` y `youtube-oauth/callback`, y `tags` (que tiene su propia regla para dejarle el `GET`
  al setter). Con el arreglo puesto, a los tres primeros el setter no llega igual: el middleware los corta antes.
- `scripts/check-permisos.ts` compara las dos capas contra los archivos reales de `src/app/api/admin`.
  Corrido el 20/9 sobre el árbol de trabajo: `OK (180 chequeos)`. **Si tocás permisos o agregás una ruta en
  `/api/admin/`, corrélo.**

Antes de asumir que está cerrado en producción: `git log --oneline -- src/lib/permisos-setter.ts`.

**La comisión del setter no se muestra en la app** (decisión del dueño, commit `4e6552f`, que la sacó de las
pantallas). No reintroducirla. En curso (v2): el árbol de trabajo además borra lo que había quedado huérfano
(`src/app/api/admin/leads/commission-monthly/route.ts` y `src/components/admin/setter/CommissionPanel.tsx`);
en `2844835` esos dos archivos todavía existen. `src/lib/commission.ts` sigue existiendo porque lo usa el
registro de ventas (`mark-sale`, `sales-summary`, `ventas/sync`, `mark-sold`).

## 6. Crons — Vercel es plan GRATUITO

**Vercel está en el plan gratuito (Hobby), confirmado por Sebastián el 19/9/2026.** Ese plan permite
como máximo **2 cron jobs y una sola ejecución por día cada uno**. `vercel.json` declara 10 entradas,
así que **no se puede asumir que un cron de Vercel corre** hasta que Sebastián mire
Vercel → Project → Settings → Cron Jobs y diga cuáles figuran activos. **No toques `vercel.json`**
sin esa lista y sin su aprobación. El Firewall / rate limiting de Vercel es de plan Pro: no está disponible.

Todos los crons se autentican con `requireCron` (`src/lib/cron.ts`): header
`Authorization: Bearer <CRON_SECRET>` (o `x-vercel-cron: 1`, que Vercel pone y no se puede falsificar
desde afuera). Sin `CRON_SECRET` configurado devuelven 500: fallan cerrado.

Declarados en `vercel.json` (horario en UTC → hora Argentina, UTC-3):

| Ruta | Cron | Hora AR | Qué hace | Estado (mirado el 20/9) |
|---|---|---|---|---|
| `/api/cron/daily-reminder` | `0 0 * * *` | 21:00 | Push de "registrá el día", racha en juego, aviso de welcome call a admins | Sin verificar si Vercel lo corre |
| `/api/cron/weekly-insight` | `0 23 * * 0` | dom 20:00 | Aviso de la retrospectiva semanal | Sin verificar |
| `/api/events/remind` | `0 8 * * *` | 05:00 | Mail (Resend) 24 h antes de un evento | Sin verificar |
| `/api/cron/leads-followup` | `0 13 * * *` | 10:00 | WhatsApp al coach por leads que no agendaron | **Roto:** filtra por `followed_up_at`, columna que no existe en producción (la migración `2026_05_06_lead_followup.sql` nunca se corrió). El plan v2 lo retira. |
| `/api/admin/sync-drive-videos` | `0 9`, `0 14`, `0 18`, `0 23` | 06, 11, 15, 20 | Importa a `video_uploads` lo que los alumnos suben a su carpeta de Drive | Sin verificar (son 4 entradas: imposible en Hobby) |
| `/api/cron/students-ready-1on1` | `0 12 * * *` | 09:00 | Marca alumnos listos para 1-a-1 y alumnos en riesgo (14 días sin actividad) | Sin verificar |
| `/api/admin/ventas/sync` | `0 11 * * *` | 08:00 | Trae las ventas de la pestaña LOOKER del CRM a `lead_sales` | **En `2844835` nunca corrió solo:** la ruta solo exportaba `POST` y Vercel Cron llama con `GET` (405). En curso (v2, WP-02): el `GET` está escrito en el árbol de trabajo (20/9), sin commitear. Aun con el `GET`, falta saber si Vercel lo tiene entre sus 2 crons. |

**Fuera de Vercel — cron-job.org:**

| Ruta | Frecuencia | Qué hace | Estado |
|---|---|---|---|
| `/api/cron/setter-no-book-followup` | cada hora | Avisa al setter (in-app + push, no WhatsApp) cuando un lead terminó el formulario hace 2 h o más y no agendó. Marca `setter_notified_no_book_at` para no repetir. | **Corre.** Verificado el 20/9 contra la base: 15 marcas en las últimas 72 h, en 12 horas distintas; la última a las 21:00 UTC de ese mismo día. |

**El aviso al setter corre en cron-job.org y se queda ahí** (decisión de Sebastián del 19/9): el plan
gratuito de Vercel no permite crons por hora. cron-job.org llama con `GET` + `Authorization: Bearer <CRON_SECRET>`.
Es el camino probado para cualquier cron que no entre en los 2 de Vercel. Esa configuración vive fuera
del repo: los agentes no la tocan.

## 7. El embudo de ventas: endpoints públicos

Son públicos (sin login, service role adentro). **Cada uno tiene efectos reales afuera de la app**:
por eso son zona sensible.

| Endpoint | Quién lo llama | Efecto |
|---|---|---|
| `POST /api/leads/quiz` | `/consultoria-gratuita` (`EvaluationQuiz`) y `/agendar` (`AgendaRapida`) | Upsert en `lead_quiz_responses` por `session_id`. Si el body trae `compromiso` **y** `urgencia` (`isInitial`) → **dispara el webhook de Make** (`lead.quiz_completed`). |
| `POST /api/leads/phone` | Paso de teléfono después de agendar | Guarda teléfono/país → notificación in-app + push a admins, **WhatsApp al coach** (CallMeBot) y webhook `lead.booked`. |
| `POST /api/leads/near-miss` | `sendBeacon` al irse sin confirmar, o timer de 60 s del resultado | Marca `near_miss_at` una sola vez → **WhatsApp al coach**. |
| `POST /api/leads/calendly-event` | Widget de Calendly embebido | Marca `calendly_loaded_at` / `calendly_datetime_selected_at` (solo la primera vez). |
| `GET /api/leads/check` | Formulario | Dice si el lead ya tiene teléfono cargado. |
| `POST` y `PATCH /api/leads/match-quiz` | `/que-luchador-sos` | Guarda en `match_quiz_responses` y devuelve el arquetipo. |
| `POST /api/track-click` y `GET /r/[slug]` | Links con seguimiento | Inserta en `link_clicks`. |
| `POST /api/client-errors` | `logger.error` del browser | Inserta en `client_errors`; el primer error de cada ventana de 6 h avisa a quien tenga la marca `errores`. En curso (v2, WP-02): tope de 32 KB por pedido y lista `RUIDO_CONOCIDO` (cortes de red, WebView de Instagram) que se guarda pero no avisa. |
| `POST /api/webhooks/calendly` | Calendly (`invitee.created` / `canceled`) | Completa nombre, mail y `scheduled_at` del lead (lo encuentra por `utm_content = session_id`) y avisa al setter. Firma: `CALENDLY_WEBHOOK_SIGNING_KEY`. **Funciona** desde agosto (el comentario de `src/lib/calendly.ts` que dice que nunca funcionó es viejo). |
| `POST /api/integrations/crm-ventas/mark-sold` | Script del CRM externo | Pasa el lead a `convertido`. Auth: `Bearer CRM_VENTAS_WEBHOOK_SECRET`; sin la variable rechaza todo. |
| `POST /api/cursos/stripe/webhook` | Stripe | Da acceso a cursos (`cursos_access`) y manda el mail. Firma: `STRIPE_WEBHOOK_SECRET`. |
| `GET /api/version` | `VersionCheck` y vos al verificar un deploy | Devuelve `{ buildId }` = primeros 8 del sha. |

**La trampa de `isInitial`.** El webhook de Make solo sale si el formulario manda `compromiso` y
`urgencia`. En septiembre se sacaron preguntas del formulario, `isInitial` pasó a ser siempre falso y
todas las automatizaciones externas se apagaron **sin ningún error visible**. Si tocás las preguntas de
cualquiera de los dos formularios, verificá que los dos sigan mandando esos dos campos.

**Modo prueba (`?qa=1` en los formularios, `qa: true` en la API).** Es de WP-06 del plan v2. **El 20/9
todavía NO existía en el código, ni en `main` ni en el árbol de trabajo** (`grep -rn "JJL-QA" src scripts`
no devuelve nada, y tampoco existe `scripts/limpiar-leads-qa.mjs`). Antes de usarlo,
comprobá que exista: `grep -rn "JJL-QA" src`. Mientras no exista, **cualquier envío completo a
`/api/leads/quiz` o `/api/leads/phone` en producción dispara Make y el WhatsApp de verdad**: no pruebes
el embudo en producción sin avisarle a Sebastián. Cuando exista: guarda la fila con
`user_agent = 'JJL-QA/1 ...'`, no dispara webhook, WhatsApp ni notificaciones, el Kanban la oculta, y
se limpia con `node scripts/limpiar-leads-qa.mjs`.

**Límite de frecuencia y `session_id`.** En `2844835` ningún endpoint público tiene tope. En curso (v2,
WP-03), escrito en el árbol de trabajo (mirado el 20/9) y **sin commitear**:
- `src/lib/rate-limit.ts`: topes por IP y por ruta (tabla `LIMITES`, ventanas de 10 minutos: `quiz` 30,
  `phone` 5, `near-miss` 5, `calendly-event` 30, `check` 60, `match-quiz` 30, `track-click` 60), contados en
  la base con la función SQL `rate_limit_hit`. **Falla abierto**: si la migración no se corrió, si la base
  tarda o no se sabe la IP, el pedido pasa (perder un lead real es peor que dejar pasar a un abusador). Se
  apaga sin deploy con `RATE_LIMIT_ENABLED=0` en Vercel. Lo importan las seis rutas de `/api/leads/*` y
  `/api/track-click`. `LIMITES` también trae una entrada `client-errors`, pero el 20/9 esa ruta **todavía no
  importaba** el módulo: no des por hecho que tiene tope.
- `supabase/migrations/2026_09_20_rate_limit.sql` (tabla `api_rate_limits` + función): **sin correr**; la
  tabla no existe en producción, así que hasta que Sebastián la corra el límite no hace nada.
- `src/lib/session-id.ts`: `lead_quiz_responses.session_id` y `match_quiz_responses.session_id` son de tipo
  `uuid`. El id de respaldo que genera `EvaluationQuiz` en navegadores sin `crypto.randomUUID`
  (`<Date.now()>-<random>`) no es un UUID y Postgres lo rechazaba; este módulo lo valida y lo convierte.

## 8. Base de datos (Supabase, producción)

Verificado el 20/9/2026 con service role: conteo de cada tabla y nombres de columnas (nunca valores). Entre corchetes, filas de ese día.

**Usuarios y curso**
- `users` [142] — `rol`, `tags`, `program_member`, `planilla_id`, `lifecycle_stage`, `started_at`,
  `onboarding_step`, `onboarding_completed_at`, `cinturon_actual`, `cinturon_confirmado_at`, `puntos`,
  `eligible_1on1_at`, `month_completed_log`, `last_contact_at`, `setter_guide_seen_at`, `drive_folder_id/url`, `avatar_url`
- `course_data` [1090] — **es una TABLA, no una vista. Una fila por alumno y por módulo**
  (`user_id`, `module_id`, `semana_numero`, `titulo`, `lessons` JSON). El curso de cada alumno es una copia.
- `user_access` [843] (módulos desbloqueados) · `user_progress` [937] (lecciones completadas; `lesson_id` sale de `course_data`)
- `lesson_video_overrides` [82] — video/título por `lesson_key` (título normalizado) para las semanas compartidas
- `modules` y `lessons` existen pero están **vacías**: no se usan.

**Actividad del alumno**
- `daily_tasks` [513] (diario) · `journal_entries` [162] · `skills`, `skill_ratings`, `skill_tasks`
- `personal_techniques`, `saved_links` (biblioteca) · `video_uploads` [174] (videos para revisar, con feedback)
- `user_sessions` [4575] · `push_subscriptions` [31] · `notifications` [7805, crece unas 2.000 por mes y nada la limpia]
- `messages` [650] (chat) · `support_messages` · `events`, `event_rsvps` · `admin_notes`, `llamadas` · `app_config` (vacía)

**Comunidad:** `posts` (con `imagen_url`, `video_url`, `pinned`), `comments`, `post_likes`, `post_polls`,
`post_poll_votes`. RPCs: `increment_likes`, `decrement_likes`, `increment_comments`, `decrement_comments`.
La tabla `likes` del esquema viejo **no existe**; es `post_likes`.

**Embudo y ventas**
- `lead_quiz_responses` [754] — el lead. Clave: `session_id` (único). Respuestas (`compromiso`, `urgencia`,
  `limitacion`, `experiencia`, `ocupacion`, `fortaleza`, `vision`, `estado`), contacto (`instagram`, `telefono`,
  `pais`, `nombre`, `email`), estado (`stage`: `nuevo`, `contactado`, `agendado`, `no_show`, `convertido`,
  `descartado`; `booked`, `disqualified`, `assigned_to`, `converted_user_id`), Calendly (`scheduled_at`,
  `calendly_event_uri`, `calendly_loaded_at`, `calendly_datetime_selected_at`), avisos
  (`setter_notified_booked_at`, `setter_notified_no_book_at`, `near_miss_at`, `followup_snooze_until`,
  `last_contact_at`), y `referrer`, `user_agent`. **No tiene `followed_up_at`.**
- `match_quiz_responses` [34] — quiz "¿Qué luchador sos?"
- `lead_contacts` [28] — historial de contactos de cada lead (`canal`, `direccion`, `nota`, `tipo_log`, `hecho_por`)
- `lead_sales` [29] — ventas (`source`: `crm`, `crm_ventas`, `manual`; `monto`, `moneda`, `is_fee`, `lead_id`, `user_id`, `crm_nombre`)
- `crm_followups` [11] — estado de los follow-ups que el setter hace sobre los `LOG_*` del CRM (`usuario`, `tipo_log`, `estado`, `snooze_until`)
- `tracked_links`, `link_clicks` [3605] — links cortos `/r/[slug]`
- `client_errors` [409] — errores del browser

**Cursos (tienda):** `cursos_courses` [7], `cursos_bundles`, `cursos_bundle_items`, `cursos_sections`,
`cursos_lessons` [338], `cursos_access` [277], `cursos_progress` [532].

**Lo que NO existe en producción aunque el repo tenga la migración o el código lo nombre** (las diez dieron 404 el 20/9):
- Vistas para Looker `v_embudo_diario`, `v_embudo_quiz_diario`, `v_leads_recuperables`, `v_agendas_registradas` (migración `2026_09_09_vistas_embudo_looker.sql` escrita, sin correr)
- `announcements` y `announcement_dismissals` (migración `2026_05_22_announcements.sql` sin correr: `/admin/anuncios` y la barra de anuncios no tienen tabla)
- `competitions` (migración `2026_04_14_competitions.sql` sin correr: `/competitions` no tiene tabla)
- `lead_quiz_responses.followed_up_at` (migración `2026_05_06_lead_followup.sql` sin correr)
- `api_rate_limits` y la función `rate_limit_hit` (WP-03: migración `2026_09_20_rate_limit.sql` escrita, sin commitear y sin correr)
- Vistas `v_ventas` y `v_embudo_mensual` (WP-04: migración `2026_09_20_vistas_ventas_setter.sql` escrita, sin commitear y sin correr; `docs/looker.md` explica por qué se corre pegada a la de las otras cuatro vistas)

**Y al revés:** `crm_followups`, `tracked_links`, `link_clicks` y `post_likes` existen en producción pero
**no tienen migración en el repo** (se crearon a mano en Supabase). `supabase/schema.sql` es el esquema
inicial, no la foto de hoy. Moraleja: **que exista el archivo de migración no prueba nada; consultá la base.**

### El curso: lo que hay que saber antes de tocarlo
- 4 planillas en `src/lib/planillas.ts`: `livianos`, `medios`, `simbio`, `atleticos`. Comparten las semanas
  -1 a 8 (`-1` = "Cómo usar la app", Fundamentos, Mes 1 y Mes 2).
- `course_data` se **duplica por alumno** y `module_id` **no siempre coincide con la semana**: hay alumnos
  viejos con otro orden del Mes 2 (`mod-5` a `mod-8` existen con dos variantes). Nunca asumas `mod-N = semana N`.
  **Se cruza por título de lección normalizado** (`normTitle` de `src/lib/admin-videos.ts`), no por `module_id`.
  Hoy ese parche vive en tres lugares: `src/app/api/course-data/route.ts`, `src/app/api/admin/update-lesson-video/route.ts`
  y `src/lib/crm.ts`. WP-08 del plan los unifica; no arranca hasta que Sebastián responda la pregunta 3 del plan.
- Todo lo que escriba en `course_data`, `user_progress` o `user_access` toca el progreso de alumnos reales:
  backup antes, `--dry` por default, y aprobación de Sebastián.

### Cinturones y puntos (`src/lib/gamification.ts`, `constants.ts`)
Blanco → Azul (semana 4 completa) → Púrpura (8) → Marrón (16) → Negro (24).
Puntos: 10 por lección + 5 por día entrenado + 50 por semana completa.

## 9. Migraciones: dónde están y quién las corre

- Se **escriben** en `supabase/migrations/AAAA_MM_DD_nombre.sql`, en español, **aditivas** (tablas, columnas,
  vistas o funciones nuevas; nunca alterar o borrar columnas existentes) e idempotentes (`if not exists`).
- **Las corre Sebastián a mano** en el SQL editor de Supabase. Los agentes **no** corren migraciones ni
  tienen CLI de Supabase configurada. Al entregar, decile qué archivo correr y qué hace.
- El código nuevo tiene que **andar aunque la migración todavía no se haya corrido** (fallar abierto o
  degradar con un `warn`), porque el push a `main` despliega antes de que Sebastián llegue al SQL editor.
- Después de que la corra, verificá con un `select` (patrón de `scripts/check-schema.mjs`).

## 10. Integraciones y variables de entorno

Los valores están en Vercel y (algunos) en `.env.local`. **Nunca se imprimen ni se pegan.**
Para leer la base desde un script: `node --env-file=.env.local <script>`. Los agentes no tienen acceso a Vercel.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase. El service role saltea RLS: solo en el server y después de validar a quien llama. |
| `CRON_SECRET` | Auth de todos los crons (Vercel y cron-job.org). |
| `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_SECRET` | Webhook de Make para el embudo. Sin URL, `dispatchLeadWebhook` loguea un warn y no hace nada. |
| `WHATSAPP_NOTIFY_PHONE`, `WHATSAPP_CALLMEBOT_KEY` | WhatsApp al coach por CallMeBot. |
| `CALENDLY_WEBHOOK_SIGNING_KEY`, `CALENDLY_TOKEN` | Firma del webhook / lectura de agendas por API (`CALENDLY_TOKEN` no está en `.env.local`). |
| `CRM_VENTAS_WEBHOOK_SECRET` | Auth de `/api/integrations/crm-ventas/mark-sold`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CURSOS_ALERT_EMAIL` | Tienda de cursos. |
| `RESEND_API_KEY`, `RESEND_API_KEY_CURSOS` | Mails del programa / de cursos. Sin key, `src/lib/email.ts` no manda y no rompe. |
| `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | Service account: Drive de alumnos y lectura de la planilla del CRM (compartida como lector). |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth de Drive de `/admin/google-drive` (las subidas usan la cuota del admin conectado). |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, `YOUTUBE_CHANNEL_ID` | YouTube Data API, solo lectura (`/admin/youtube-import`). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push. |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_AUTH`, `NEXT_PUBLIC_SITE` (solo dev), `NEXT_PUBLIC_BUILD_ID` | Varias. |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID` | Las pone Vercel; de ahí sale el `buildId`. |

Lo que Vercel tiene cargado de verdad **no se pudo verificar desde el repo** (se infiere de que el webhook
de Calendly, el sync de ventas manual y el cron externo funcionan).

Sistemas externos que alimentan la app y **no se tocan desde acá**: Make, ManyChat (escribe las pestañas
`LOG_*` del CRM), la planilla del CRM en Google Sheets (pestaña `LOOKER` para ventas), Calendly, Stripe,
cron-job.org, CallMeBot.

## 11. Cómo verificar

**Antes de commitear** (ver Reglas 2):
```
npx tsc --noEmit -p .                 → 0 errores
npx eslint <los archivos que tocaste> → 0 errores
```
- El repo entero **no** está en cero de lint: `npx eslint src` sobre el árbol de trabajo del 20/9 dio 208
  problemas (150 errores, 58 warnings). Por eso se lintea **solo lo que tocaste**. WP-09 lo lleva a cero y
  agrega CI (`.github/workflows/ci.yml`, en curso (v2), sin commitear). Ojo: `lint:ci` corta con cualquier
  error, así que mientras queden errores viejos el CI va a salir con cruz roja aunque tu cambio esté bien.
  Igual no bloquea el deploy.
- Si `tsc` falla con algo de `.next/dev/types` o `.next/types` (una ruta de prueba que alguien creó y borró),
  borrá **solo** esas dos carpetas y volvé a correr.
- Probá en el navegador con `npm run dev` (puerto 3000) lo que cambiaste. El sitio Cursos en local: `/cursos`.

**Después del push** (2 a 5 minutos):
```
git rev-parse --short=8 HEAD
curl -s https://alumno.jiujitsulatino.com/api/version
curl -s https://alumno.jiujitsulatino.com/sw.js | grep CACHE_NAME
```
Los tres tienen que coincidir: `{"buildId":"<sha8>"}` y `CACHE_NAME = 'jjl-<sha8>'`. (Probado el 20/9:
`/api/version` dio `2844835f`, igual que `HEAD`.) Después abrí en producción la pantalla que tocaste.
Si algo está roto: `git revert <sha> && git push`. Los agentes no tienen acceso a Vercel; Sebastián puede
promover el deploy anterior desde ahí, que es instantáneo.

**No pushear entre las 18:00 y las 23:00 hora Argentina** salvo hotfix: es cuando los alumnos usan la app,
y un deploy con la app abierta puede dejarles la pantalla de error de "chunk" hasta que recargan.

## 12. Trampas conocidas (cada una ya costó un bug)

- **Barras invertidas perdidas.** Código con `\` escrito por heredoc de bash pierde la barra en silencio.
  Así se rompieron los handles de Instagram (`/\s+/` quedó como `/s+/` y les sacó las "s" a los usuarios
  entre el 30/8 y el 9/9). Los archivos se escriben con las herramientas de edición. Ver Reglas 3.
- **`npm run build` ensucia el árbol:** `scripts/build-sw.mjs` reescribe `CACHE_NAME` en `public/sw.js`, que
  está versionado. En el repo tiene que quedar `'jjl-dev'`. Ya llegó a producción con marcas de conflicto por esto.
- **`isInitial`** (sección 7): sacar una pregunta del formulario puede apagar Make sin ningún error.
- **`module_id` no es la semana** (sección 8): cruzar por título normalizado.
- **Que haya migración no significa que la tabla exista** (sección 8).
- **El setter es `rol='admin'` + marca**, así que cualquier chequeo que solo mire `rol==='admin'` lo deja pasar.
  Usá `requireAdmin(request)` y no auth a mano.
- **El middleware corre también en `/api/*`** (el comentario del matcher de `src/middleware.ts` dice lo
  contrario, pero la regex no excluye `api`).
- `UserProvider` carga el perfil una sola vez: para un avatar recién cambiado hay que leer de la base.
- iOS Safari no tiene Fullscreen API para iframes: el reproductor usa pantalla completa por CSS. Inputs con
  fuente de 16 px en mobile (si no, iOS hace zoom). El logo es negro con fondo transparente: va sobre círculo blanco.

## 13. Estado de la v2 (foto del 20/9/2026)

El plan está en `docs/plan-v2.md`. Un paquete (WP) por sesión; cada agente lee su ficha y las Reglas.
Esta sección es una foto: **confirmá con `git log` y `git status` antes de creerle.**

- En `main` / producción: `2844835` (`HEAD` local = `origin/main` = `/api/version`). **Ningún paquete de v2
  está commiteado todavía**: todo lo de abajo vive solo en el árbol de trabajo (52 entradas en `git status`).
- En curso (v2) en el árbol de trabajo, **sin commitear**, vistos el 20/9 (varios agentes trabajando a la vez):
  - WP-01: `src/lib/permisos-setter.ts`, gate de setter en el host Cursos, `requireAdmin` que rechaza setters
    por defecto + `verificarAdmin`, las siete rutas de auth a mano ya pasadas a ese helper (sección 5),
    `scripts/check-permisos.ts` (da `OK (180 chequeos)`), y el borrado de `commission-monthly` y `CommissionPanel`.
  - WP-02: `GET` en `/api/admin/ventas/sync`, cambios en `src/lib/crm-ventas.ts` y `weekly-insight`, y en
    `client-errors` el tope de 32 KB y la lista `RUIDO_CONOCIDO`.
  - WP-03: `src/lib/rate-limit.ts`, `src/lib/session-id.ts`, `supabase/migrations/2026_09_20_rate_limit.sql`
    y cambios en las seis rutas de `/api/leads/*` y en `/api/track-click` (`client-errors` todavía no usa el tope).
  - WP-04: `supabase/migrations/2026_09_20_vistas_ventas_setter.sql`, `scripts/embudo-check.mjs` (solo lectura)
    y `docs/looker.md`.
  - WP-05: `scripts/recuperar-handles.mjs` (escribe datos: `--dry` por default; no aplicar sin aprobación de Sebastián).
  - WP-07: `src/lib/logger.ts`, `src/app/error.tsx`, `src/components/VersionCheck.tsx` (constante
    `RECARGA_AUTOMATICA` arriba del archivo: se apaga con un commit de una línea), `PushPrompt`, `TaskDashboard`.
  - WP-08 (solo el paso 1, de lectura): `scripts/diagnostico-mes2.mjs`. La alineación en sí no arrancó.
  - WP-09: `typecheck` y `lint:ci` en `package.json`, `.github/workflows/ci.yml` (tipos + lint; **avisa, no
    bloquea**: Vercel despliega igual apenas llega el push) y limpieza de lint/tipos en `src/lib/planillas.ts`
    (import estático de `mock-data` en vez de `require`), `EvaluationQuiz` (íconos sin usar) y las rutas
    `events`, `leaderboard`, `messages` y `skills`. Quedan 150 errores de lint en `src` (sección 11).
  - WP-11: `scripts/backups/` agregado a `.gitignore`, el comentario corregido de `src/lib/calendly.ts`
    (decía que el webhook de Calendly nunca funcionó; es falso), y este archivo y el `README.md`.
- Todavía no existen (20/9): `scripts/check-embudo.ts`, `scripts/limpiar-leads-qa.mjs` y el modo prueba (WP-06);
  `docs/qa.md` y los smoke tests (WP-10); `src/lib/course-merge.ts` (WP-08).
- Pendiente de Sebastián: decir qué crons figuran activos en Vercel; correr las migraciones (las dos de vistas
  de Looker, **seguidas** y en el orden de `docs/looker.md`, y `2026_09_20_rate_limit.sql`; el 20/9 ninguna
  estaba corrida); responder las preguntas 2 y 3 del plan (WP-08 no arranca sin la 3); crear las 2 cuentas de
  prueba para QA.
- Limpieza pendiente (WP-11, pasos que no son documentación): mover los one-offs de `scripts/` a
  `scripts/archivo/` (el 20/9 `scripts/` tenía 50 entradas, 15 de ellas backups JSON sueltos), borrar
  `CLAUDE.md.bak` y `docs/superpowers/plans/2026-04-14-onboarding-tour.md.bak`, y borrar las ramas locales
  `comunidad-media` y `quiz-luchador-rebalance` si Sebastián confirma (según las referencias locales de git,
  en `origin` solo figura `main`).

---

## Reglas

Son la sección 6 de `docs/plan-v2.md`, tal cual. Si una sesión trae reglas propias más estrictas (por
ejemplo "no commitear" cuando hay varios agentes en el mismo árbol), **mandan las de la sesión**.

Dos cosas del contexto que las reglas dan por sabidas: **Vercel es plan gratuito** (2 crons, una vez por día:
no agregues crons a `vercel.json`) y **el aviso al setter corre en cron-job.org**, no en Vercel (sección 6).

```
REGLAS DEL REPO jjl-app (C:\claude-projects\jjl-app) — leerlas antes de tocar nada

1. Idioma y estilo. Todo comentario nuevo en español, explicando el PORQUÉ (no el qué).
   Nombres nuevos en español (funciones, variables, archivos): `permisoDeSetter`,
   `alinearMes2`. No renombrar lo que ya existe en inglés.

2. Verificación mínima antes de cada commit:
     npx tsc --noEmit            (0 errores)
     npx eslint <archivos que tocaste>   (0 errores)
   Y probar en el navegador con `npm run dev` (puerto 3000) lo que cambiaste.

3. Barras invertidas. NUNCA escribir código con `\` (regex, `\n`, `\u0300`) dentro de un
   heredoc de bash: se pierden en silencio y ya causaron tres bugs. Los archivos se
   escriben con las herramientas de edición, no con `cat <<EOF`. Si un regex tiene que
   ir por bash igual, usar clases: `[/]`, `[.]`, `[^A-Za-z0-9._]`. Para sacar tildes,
   reutilizar `normTitle` de src/lib/admin-videos.ts. Los scripts de verificación se
   escriben como archivos .ts/.mjs con asserts y se corren con `npx tsx` / `node`.

4. Commits. Mensaje en español, primera línea corta que diga qué cambia para la persona,
   cuerpo con el porqué. Siempre así (nunca backticks dentro de comillas dobles):
     git commit -F - <<'MSG'
     Título corto

     Explicación del porqué.

     Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
     MSG
   Solo commitear y pushear cuando el paquete lo indique. Cada push a main despliega
   a producción.

5. Credenciales. No pegar, pedir, ni loguear claves, tokens ni contraseñas. `.env.local`
   se lee con scripts (patrón de scripts/check-schema.mjs); jamás se imprime. Las
   credenciales de las cuentas de prueba llegan por variables de entorno de la sesión.

6. Base de datos. No correr migraciones ni cambiar configuración persistente (Vercel,
   ManyChat, Calendly, Supabase, tareas programadas) sin aprobación explícita de
   Sebastián. Las migraciones se escriben en supabase/migrations/ con fecha, en español,
   aditivas, y se le avisa qué hacen. Las consultas de diagnóstico son solo `select`.
   Todo script que escriba datos tiene `--dry` por default, `--aplicar` explícito, y
   guarda un backup JSON en scripts/backups/ antes de escribir.

7. Producción y el embudo. Para probar en producción, usar `?qa=1` (formularios) o
   `qa: true` (API), que no dispara el webhook de Make, el WhatsApp ni las notificaciones.
   Si el paquete exige un envío real, AVISAR a Sebastián antes y borrar la fila después
   (node scripts/limpiar-leads-qa.mjs). No agendar en Calendly. No publicar en la
   comunidad. No mandar mensajes a alumnos.

8. No romper lo que anda. Zonas sensibles: src/app/api/leads/quiz/route.ts (la condición
   `isInitial` dispara el webhook), src/lib/lead-webhook.ts, src/app/api/cron/*,
   vercel.json, src/lib/supabase/middleware.ts y server.ts (permisos), public/sw.js,
   src/components/video/CustomVideoPlayer.tsx, y todo lo que escriba en course_data /
   user_progress / user_access. Cambios ahí: diff mínimo y verificación explícita.

9. Build local. NO correr `npm run build`: escribe en public/sw.js y ensucia el árbol.
   Si hace falta compilar, `npx next build` y después `git checkout public/sw.js`.

10. Limpieza. Al terminar: borrar páginas/archivos temporales, revisar `git status`,
    borrar .next/dev/types si creaste rutas de prueba, y no dejar scripts sueltos fuera de
    scripts/. Los archivos temporales van al scratchpad de la sesión.

11. Verificar el deploy. Después del push, esperar 2–5 minutos y correr:
      curl -s https://alumno.jiujitsulatino.com/sw.js | grep CACHE_NAME
    Tiene que decir `jjl-<primeros 8 del sha del commit>`. Después abrir en el navegador
    la pantalla que tocaste. Si algo está roto: `git revert <sha> && git push`.

12. Comisión del setter. No se muestra en la app por decisión del dueño. No reintroducirla.

13. Informe final de la sesión en español rioplatense, sin emojis: qué cambió, cómo se
    verificó (comandos y qué se vio), qué queda para Sebastián, y qué NO se pudo verificar.
```

Nota sobre la regla 7: el modo prueba que menciona es de WP-06 y el 20/9 todavía no estaba en el código
(sección 7). Hasta que esté, la regla que vale es la segunda mitad: avisar antes de cualquier envío real.

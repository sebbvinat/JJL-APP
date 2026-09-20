# JJL App v2 — Plan de release

Fecha del relevamiento: 19/9/2026. Rama `main` en `311fd0a`, desplegada en producción (verificado: `https://alumno.jiujitsulatino.com/sw.js` dice `jjl-311fd0ac`).

Diseñado por Claude Fable 5.1 a partir del código, el historial de git, lint/tsc y consultas de solo lectura a la base de producción. Lo ejecutan agentes Claude Opus, un paquete de trabajo (WP) por sesión, leyendo solo la ficha del paquete y la sección 6 (Reglas).

---

## 1. Resumen para Sebastián

**Qué cambia para el alumno.** La app deja de "romperse sola" cuando sale una versión nueva (hoy, si un alumno tiene la app abierta durante un deploy, puede quedar con una pantalla de error hasta que recarga a mano) y los errores de red del celular dejan de tratarse como bugs. Los alumnos que entraron antes de mayo tienen el "Mes 2" con otro orden y otros títulos que el resto: lo alineamos con cuidado, sin perderles el progreso.

**Qué cambia para el setter y para vos.** Se cierra un agujero real de permisos (hoy un setter con cuenta de admin puede usar cualquier endpoint de admin entrando por `jiujitsulatino.com` en vez de `alumno.`). El cron que trae las ventas del CRM **no corre desde que existe** (Vercel lo llama con GET y la ruta solo acepta POST); se arregla. Los ~13 handles de Instagram que el bug de las "s" rompió y que se pueden probar, se recuperan solos; el resto queda en una lista para corregir a mano. Las vistas para Looker se corren y se amplían con ventas y setter.

**Qué cambia para el negocio.** Los endpoints públicos del embudo (quiz, formulario, teléfono) hoy no tienen ningún límite: cualquiera puede inundar tu WhatsApp y el webhook de Make. Se les pone un límite y un "modo prueba" para poder testear en producción sin disparar automatizaciones reales. Y por primera vez hay una red de seguridad: chequeo de tipos y lint en cada push a GitHub, un script que verifica que el quiz, /agendar y el webhook sigan hablando el mismo idioma, y una tarea de QA que recorre la app como alumno/lead/setter buscando errores.

**Por qué vale la pena.** Todo lo de arriba son cosas que ya te pasaron o te están pasando (ventas que no se sincronizan, leads con handle roto, errores fantasma), no features nuevas. La v2 es "que lo que hay funcione y se pueda medir", que es lo que hace falta antes de seguir agregando.

---

## 2. Diagnóstico

### 2.1 Confirmado (con evidencia)

**Seguridad**

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| D1 | **La lista blanca del setter no aplica en el host de cursos.** El gate de setter vive solo en `handleAlumno`. En `handleCursos`, todo `/api/*` pasa sin chequeo. Un setter con `rol='admin'` (hoy hay uno: consulté la base, hay un admin con tag `setter`) puede llamar `https://jiujitsulatino.com/api/admin/update-role`, `/api/admin/analytics`, `/api/admin/delete-user`, etc. `requireAdmin()` sin opciones lo deja pasar porque es `rol='admin'`. | `src/lib/supabase/middleware.ts:136-140` (gate solo en alumno) y `:278-280` (cursos: `/api/*` sale sin gate). `src/lib/supabase/server.ts:119` (solo rechaza si no es admin). Rutas que ni usan `requireAdmin` y solo chequean `rol==='admin'`: `src/app/api/admin/analytics/route.ts`, `soporte/route.ts`, `sync-planillas/route.ts`, `announcements/route.ts`, `link-drive-folder/route.ts`, `import-drive-video/route.ts`, `student-diary/route.ts`. | Seguridad. Escalada completa de un setter a admin. |
| D2 | **Endpoints públicos del embudo sin límite ni validación de `session_id`.** `/api/leads/quiz` acepta cualquier string como `session_id` (la columna es UUID → Postgres tira error y se devuelve `error.message` al cliente). `/api/leads/phone` manda un WhatsApp al coach y un webhook a Make por cada POST, y además espera hasta 3,5 s por request. `/api/leads/near-miss` manda WhatsApp. `/api/track-click` y `/api/client-errors` insertan sin tope de frecuencia. No hay rate limiting en ningún lado (`grep ratelimit/upstash` en `src`: 0 resultados). | `src/app/api/leads/quiz/route.ts:35`, `:102`; `src/app/api/leads/phone/route.ts:148-174`, `:210`; `src/app/api/leads/near-miss/route.ts:77`; `src/app/api/track-click/route.ts:28`; `src/app/api/client-errors/route.ts:62`. | Ventas + costo: spam de WhatsApp/Make, tabla llena de basura. Seguridad: fuga de mensajes de error de la base. |

**Ventas y datos**

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| D3 | **El cron diario de ventas nunca corre.** `vercel.json` programa `/api/admin/ventas/sync` a las 11:00, pero la ruta solo exporta `POST`; Vercel Cron invoca con `GET` → 405. Solo se sincroniza cuando alguien aprieta el botón a mano. | `vercel.json` (cron `"/api/admin/ventas/sync"`), `src/app/api/admin/ventas/sync/route.ts:35` (único export es `POST`). | Ventas/métricas: `lead_sales` queda atrasada, cash collected desactualizado. |
| D3b | **El cron diario `leads-followup` falla desde mayo.** Filtra por `followed_up_at`, columna que no existe: la migración `2026_05_06_lead_followup.sql` nunca se corrió (verificado el 19/9 consultando la tabla). El select da error y el cron devuelve 500 todos los días. No se nota porque `setter-no-book-followup` (cron-job.org, cada hora) cubre el mismo aviso y ese sí corre: hay marcas en `setter_notified_no_book_at` casi todas las horas del 16 al 19/9. | `src/app/api/cron/leads-followup/route.ts:55` (`.is('followed_up_at', null)`), `supabase/migrations/2026_05_06_lead_followup.sql`. | Mantenimiento: un cron muerto que ocupa lugar en un plan gratuito de Vercel (ver 2.2). |
| D4 | **Handles de Instagram corruptos entre ~30/8 y 9/9.** El bug (`replace(/s+/g,'')` por una barra invertida perdida) se arregló en `5fece7d` (9/9). En la base: entre el 25 y el 28/8 el 45 % de los handles tiene alguna "s"; del 30/8 al 9/9 baja al 15 %; el 10/9 vuelve a 57 %. Son 58 leads del período, 34 con el handle original en el `referrer` (`?ig=...`) y **13 de esos tienen guardado un handle distinto al del link**: recuperables con certeza. El resto necesita otra fuente (Calendly guarda el handle en la pregunta `a4`, ver `src/lib/calendly-url.ts:22`). | `git show 5fece7d -- src/components/consultoria/EvaluationQuiz.tsx` (líneas `-158/+162`). Datos: consulta a `lead_quiz_responses` del 25/8 al 12/9. | Ventas: el setter no encuentra a la persona en Instagram. |
| D5 | **Las vistas para Looker NO existen en producción.** `v_embudo_diario`, `v_embudo_quiz_diario`, `v_leads_recuperables`, `v_agendas_registradas`: las cuatro devuelven "Could not find the table". | `supabase/migrations/2026_09_09_vistas_embudo_looker.sql` escrita; consulta directa a la base. | Métricas: Sebastián sigue dependiendo de la pestaña LOOKER del CRM, que está desactualizada. |
| D6 | **Drift real del "Mes 2" en `course_data`.** `mod-5` existe con dos variantes (`sem 5: Escape 100KG I` y `sem 8: 100KG + Kimura`), igual `mod-6`, `mod-7`, `mod-8`. O sea: hay alumnos con el orden viejo (finalizaciones primero) y alumnos con el nuevo. El código lo parchea matcheando por título en tres lugares distintos. `lesson_video_overrides` tiene 82 filas (mod-4..mod-18). `course_data` tiene 1090 filas y `user_access` 843: hay módulos sin fila de acceso. | Datos (consulta a `course_data`). Parches: `src/app/api/course-data/route.ts:99-130`, `src/app/api/admin/update-lesson-video/route.ts:62-68`, `src/lib/crm.ts:7-11`. | Alumno: semanas vacías o videos en el módulo equivocado (ya pasó con semanas 7-8). Mantenimiento: cada feature del curso carga con el parche. |
| D7 | **El webhook de Calendly SÍ funciona** (contradice el comentario del código). Desde agosto: 109 agendados, 106 con `scheduled_at`, nombre y email; el último el 18/9. El comentario "nunca llegó a funcionar" en `src/lib/calendly.ts:6-9` es viejo y puede llevar a un agente a decisiones equivocadas. | Datos + `src/lib/calendly.ts:6-9`. | Mantenimiento. |

**Estabilidad y experiencia en celular**

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| D8 | **Deploy en medio de una sesión = pantalla de error.** `client_errors` de los últimos 14 días: 2 `error-boundary` con "Failed to load chunk /_next/static/chunks/..." (iPhone, en `/upload` y `/modules`). Cuando sale un deploy, los chunks viejos dejan de existir; la app muestra "Algo salió mal" y el `VersionCheck` solo muestra un banner (no recarga). | `src/app/error.tsx:14-23` (solo detecta errores de red, no de chunk), `src/components/VersionCheck.tsx:22-27`. Datos: `client_errors`. | Alumno: pantalla rota tras cada push a main (y hoy se pushea varias veces por día). |
| D9 | **El error-tracking está lleno de ruido y esconde lo real.** De 35 errores en 14 días: 11 "Failed to update a ServiceWorker", 9 "Error invoking postMessage: Java object is gone" (WebView Android/YouTube), 8 "Load failed" en `push.saveSubscription.failed` / `dashboard.checkin.failed` (red iOS). Ninguno es un bug. Los 2 de chunk (D8) sí lo son y quedan tapados. La alerta de "Errores en la app" se dispara igual. | `src/lib/logger.ts:36-53` (filtra solo dos patrones), `src/app/api/client-errors/route.ts:71-107`. | Mantenimiento: la alerta pierde valor; vos dejás de mirarla. |
| D10 | **`notifications` crece sin límite.** 7.790 filas, ~2.000 por mes (cada post de la comunidad genera 140 filas). Nada las borra. | `src/lib/notifications.ts` (`createNotificationsBulk`), datos. | Costo: egress y tamaño del plan Free de Supabase. |
| D11 | **El feed lee TODOS los votos de todas las encuestas en cada carga.** `post_poll_votes` se trae entero sin filtrar por `post_id`. | `src/app/api/community/posts/route.ts:64`. | Alumno (celular): más lento a medida que hay encuestas. |

**Calidad y mantenimiento**

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| D12 | **Lint: 217 errores y 73 warnings en 87 archivos.** 164 `no-explicit-any`, 19 `react-hooks/immutability`, 9 `set-state-in-effect`, 6 `purity`. Peores: `CustomVideoPlayer.tsx` (23), `community/posts/route.ts` (19), `admin/analytics/route.ts` (14), `posts/[postId]/route.ts` (12). No hay CI: no existe `.github/`, y `next build` en Next 16 no corre lint. | `npx eslint src` (corrido el 19/9). | Mantenimiento: nadie sabe cuándo se rompe algo hasta que un alumno avisa. |
| D13 | **`tsc --noEmit` falla por un resto temporal.** `.next/dev/types/validator.ts:557` referencia `src/app/r/prueba-video-tmp/page.js`, una página de prueba que un agente creó y borró sin limpiar `.next`. | Salida de `npx tsc --noEmit`. | Mantenimiento: el chequeo de tipos "está rojo" y se ignora. |
| D14 | **Barras invertidas perdidas en el código (síntoma del heredoc).** `crm-ventas.ts:48` hace `.replace(/\n/g, '\n')` (no hace nada; en `crm-logs.ts:145` está bien con `/\\n/g`). `sync-drive-videos/route.ts:58` y `agendas-client.tsx:33` tienen `/[̀-ͯ]/g` con los caracteres combinantes literales en vez de `\u0300-\u036f` (funciona de casualidad). El bug de las "s" (D4) fue lo mismo. | Archivos citados. | Mantenimiento: es la fuente de bugs más repetida del proyecto. |
| D15 | **Código muerto y docs viejas.** `CommissionPanel.tsx` y `/api/admin/leads/commission-monthly` ya no se usan (la comisión se sacó en `4e6552f`) pero la ruta sigue en la lista blanca del setter. `CLAUDE.md` dice "Service worker cache version actual: v3", lista tablas que ya no describen la base y no menciona leads, cursos pagos, tags ni crons nuevos. `README.md` es el de create-next-app. `docs/superpowers` es de abril. | `src/components/admin/setter/CommissionPanel.tsx`, `CLAUDE.md`, `README.md`. | Mantenimiento: los agentes arrancan con información falsa. |
| D16 | **El script de build modifica un archivo versionado.** `npm run build` escribe `CACHE_NAME` en `public/sw.js`; si un agente lo corre localmente, deja el árbol sucio y ya provocó marcas de conflicto en producción (`fb72b38`). | `scripts/build-sw.mjs:24`, `package.json` (`build`). | Mantenimiento. |

### 2.2 Sospechado (no se pudo verificar)

- ~~`/api/cron/setter-no-book-followup` en cron-job.org: ¿sigue activo?~~ **Resuelto el 19/9:** Sebastián confirma que está activo y la base lo prueba (marcas cada hora del 16 al 19/9). Se queda ahí: el plan gratuito de Vercel no permite crons por hora.
- **Variables de entorno en Vercel.** No se pueden ver `LEAD_WEBHOOK_URL`, `CALENDLY_WEBHOOK_SIGNING_KEY`, `WHATSAPP_*`, `CRON_SECRET`, `CALENDLY_TOKEN`. Por los datos (webhook de Calendly funcionando, `lead_sales` con `source='crm_ventas'`) se infiere que están, pero no está verificado.
- **Plan de Vercel: es GRATUITO (Hobby), confirmado por Sebastián el 19/9.** Hobby permite 2 cron jobs como máximo y solo una ejecución por día; `vercel.json` declara 10. No se pudo verificar desde el repo cuáles corren de verdad. **[ACCIÓN DE SEBASTIÁN]** mirar Vercel → Project → Settings → Cron Jobs y decir cuáles figuran activos y con qué última ejecución. Hasta tener eso, ningún paquete puede asumir que un cron de Vercel corre. El rate limiting (WP-03) se hace en la app, no en el Firewall de Vercel (es de Pro).
- **Pestaña LOOKER desactualizada desde el 5/8.** Es un problema del CRM/Make, no de la app; la app solo la lee (`src/lib/crm-ventas.ts`). Lo único que la app puede hacer es dejar de depender de ella (D5).
- **Rendimiento real en celular.** No hay métricas de campo. `SessionTracker` guarda sesiones (28 usuarios con sesión en 14 días, 15 alumnos con diario) pero no tiempos de carga. El feed inicial trae 50 posts con thumbnails lazy; `/auditoria` sirve 24 MB de mp4 con `preload="metadata"` (bien). Nada grave a la vista, pero sin datos.
- **Ramas sin mergear.** `comunidad-media` (1 commit, ya está en main con otro hash) y `quiz-luchador-rebalance` (vacía). Se pueden borrar; no se verificó si tienen algo más en remoto.

---

## 3. Alcance de v2 priorizado

### Tema A — Estabilidad y seguridad (P0)

| Ítem | Por qué | Prioridad |
|---|---|---|
| A1. Cerrar el bypass del setter por host de cursos y hacer que `requireAdmin` rechace setters por defecto | D1: escalada a admin completo | **P0** |
| A2. Arreglar el cron de ventas (GET) y decidir el de no-agendó | D3 + sospecha | **P0** |
| A3. Límite de frecuencia + validación estricta en `/api/leads/*`, `/api/track-click`, `/api/client-errors` | D2: spam a tu WhatsApp/Make | **P0** |
| A4. Recarga automática ante chunk viejo; no reportar errores de red como bugs; alerta de errores solo para errores reales | D8, D9 | **P1** |

Queda afuera a propósito: cambiar de CallMeBot a WhatsApp Business API; agregar Sentry (el `logger` ya es la costura, se hace después si hace falta).

### Tema B — Embudo y medición (P0/P1)

| Ítem | Por qué | Prioridad |
|---|---|---|
| B1. Correr las vistas Looker y sumar ventas + setter (con usuario de solo lectura) | D5, LOOKER desactualizada | **P0** (la migración la corre Sebastián) |
| B2. Recuperar handles corruptos (13 seguros) + lista del resto | D4 | **P1** |
| B3. "Contrato" del embudo verificable: valores del quiz/agendar/etiquetas en un solo lugar + script de asserts + modo prueba (`qa: true`) que no dispara webhook/WhatsApp | Los tres bugs recientes por datos (`serio`/`enserio`, webhook apagado, handles) | **P1** |

Queda afuera: arreglar los flujos de ManyChat (se hace en ManyChat); traer a la app los leads que el equipo agenda directo en Calendly (ver pregunta 5).

### Tema C — Experiencia del alumno en celular (P1)

| Ítem | Por qué | Prioridad |
|---|---|---|
| C1. Alinear el Mes 2 de los alumnos viejos sin perder progreso, y dejar UNA función de merge de overrides | D6 | **P1** (requiere aprobación: toca datos de alumnos) |
| C2. Feed: filtrar votos por post; limpieza de notificaciones viejas en el cron semanal | D10, D11 | **P2** |

Queda afuera: rediseños de UI, videos offline, nueva navegación. La lección "Observaciones finales toreos" sin video es contenido (Sebastián carga el YouTube ID desde /admin/videos).

### Tema D — Panel del setter/admin (P2)

Solo lo que cae de otros paquetes: sacar `CommissionPanel` y su ruta de la lista blanca (A1), ocultar leads de prueba (B3). No se agrega funcionalidad nueva al Kanban en v2.

### Tema E — Calidad y QA (P1)

| Ítem | Por qué | Prioridad |
|---|---|---|
| E1. Lint a cero errores + `npm run typecheck` + CI en GitHub (tsc + eslint en cada push) | D12, D13 | **P1** |
| E2. QA automatizado: smoke tests con Playwright (landing, quiz, agendar, login, dashboard, comunidad, agendas) + tarea programada semanal que recorre la app como alumno/lead/setter | Pedido pendiente | **P1** (requiere usuarios de prueba) |
| E3. Docs y limpieza: `CLAUDE.md`, `README.md`, comentario viejo de Calendly, código muerto, `scripts/` archivados | D14, D15, D16 | **P2** |

---

## 4. Paquetes de trabajo para Opus

Cada paquete es una sesión. Todos asumen las **Reglas para los agentes** de la sección 6. "Acción manual" = algo que tiene que hacer Sebastián; está marcado con **[ACCIÓN DE SEBASTIÁN]**.

---

### WP-01 — Permisos del setter: cerrar el bypass por host y fallar cerrado

**Objetivo.** Que ningún endpoint de admin le responda a un setter salvo los de la lista blanca, sin importar por qué dominio entre.

**Archivos.**
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/server.ts`
- `src/app/api/admin/tags/route.ts` (solo para confirmar que `GET` sigue abierto al setter)
- Nuevo: `src/lib/permisos-setter.ts` (función pura) y `scripts/check-permisos.ts` (asserts)
- Borrar: `src/components/admin/setter/CommissionPanel.tsx`, `src/app/api/admin/leads/commission-monthly/route.ts` (código muerto; ver D15)

**Pasos.**
1. Extraer de `middleware.ts` las constantes `SETTER_ALLOWED_PREFIXES`, `SETTER_ALLOWED_GET_ONLY` y la función `isSetterAllowed` a `src/lib/permisos-setter.ts` como función pura `setterPuedeUsar(pathname, method): boolean`. Sin imports de Next (tiene que poder correr con `tsx`).
2. En `middleware.ts`, aplicar el gate de setter **también en `handleCursos`** para `pathname.startsWith('/api/admin/')`: si hay usuario y tiene tag `setter` y `!setterPuedeUsar(...)` → 403 JSON. Reutilizar la misma lectura de perfil (una sola query).
3. En `server.ts`, `requireAdmin`: si `tags.includes('setter')` y `!opts?.allowSetter` → devolver `null`. Comentar el porqué (el setter con `rol='admin'` pasaba todos los endpoints). Verificar con `grep -rn "allowSetter: true" src/app/api` que todas las rutas que el setter necesita (leads, leads/[id], contacts, convert, mark-sale, sales-summary, setter/*, auth/me) ya lo tienen. `ventas/sync` usa `denyTags: ['setter']`: queda redundante pero inofensivo.
4. Las 7 rutas que hacen auth a mano (`admin/analytics`, `admin/soporte`, `admin/soporte/[userId]`, `admin/sync-planillas`, `admin/announcements` y `[id]`, `admin/link-drive-folder`, `admin/import-drive-video`, `admin/student-diary`): migrarlas a `requireAdmin(request)` (sin `allowSetter`). Mantener el mismo shape de respuesta y los mismos códigos de error. Si una ruta necesita el cliente de sesión (RLS) además del admin, `requireAdmin` ya devuelve `supabase` y `admin`.
5. Borrar `CommissionPanel.tsx` y la ruta `commission-monthly` (verificar con `grep -rn commission-monthly src` que no quede ningún uso). No tocar `sales-summary` ni `lib/commission.ts` (los usa `mark-sold`).
6. Escribir `scripts/check-permisos.ts` con asserts sobre `setterPuedeUsar`: permitidos (`/api/admin/leads`, `/api/admin/leads/x/contacts`, `/api/admin/setter/agenda`, `GET /api/admin/tags`) y prohibidos (`PATCH /api/admin/tags`, `/api/admin/update-role`, `/api/admin/analytics`, `/api/admin/leads/commission-monthly` ya no existe → prohibido por default, `/api/admin/alumnos`).

**Criterios de aceptación.**
- `npx tsx scripts/check-permisos.ts` termina en 0 con "OK".
- `npx tsc --noEmit` sin errores nuevos; `npx eslint` limpio en los archivos tocados.
- En producción, logueado como el setter admin: `https://alumno.jiujitsulatino.com/admin/agendas` sigue funcionando entero (Kanban, drawer, follow-ups, agenda, quiz-leads, alta de alumno desde lead). Y `https://jiujitsulatino.com/api/admin/analytics` devuelve `{"error":"No autorizado"}` con 403.
- Logueado como admin pleno: `/admin/analytics`, `/admin/soporte`, `/admin/courses` (botón sincronizar), `/admin/anuncios`, `/admin/google-drive` siguen funcionando.

**Cómo verificarlo.** Local: `npm run dev`, entrar con la cuenta de Sebastián (admin) y probar las 5 páginas del último punto. El caso setter en el host de cursos hay que probarlo en producción con la cuenta del setter admin (pedirle a Sebastián que lo haga): abrir DevTools → Console → `fetch('/api/admin/analytics').then(r=>r.status)` desde `https://jiujitsulatino.com/mis-cursos` y esperar `403`.

**Riesgos / cómo no romper.** El riesgo es dejar al setter sin algo que usa. Antes de tocar, listar los `fetch('/api/...')` de `src/components/admin/setter/*` y `agendas-client.tsx` (hoy: leads, leads/[id], contacts, mark-sale, convert, alumnos [solo admin, a propósito], setter/quiz-leads, setter/followups, setter/agenda, setter/guide-seen, tags GET, auth/me) y confirmar que todos siguen en la lista blanca. No tocar `ConvertToAlumnoModal` ni `AgendaCalendly`.

**Dependencias.** Ninguna. Es el primero.

**Acción manual.** Ninguna de configuración. **[ACCIÓN DE SEBASTIÁN]** probar como setter en producción después del deploy (5 minutos).

---

### WP-02 — Crons que sí corren, y errores que sí importan (lado servidor)

**Objetivo.** Que el sync de ventas corra solo todos los días, que el aviso de "no agendó" tenga dueño, que las notificaciones viejas se limpien y que la alerta "Errores en la app" solo salte por errores reales.

**Archivos.**
- `src/app/api/admin/ventas/sync/route.ts`
- `vercel.json`
- `src/app/api/cron/weekly-insight/route.ts` (agregar limpieza de notificaciones)
- `src/app/api/client-errors/route.ts`
- `src/lib/crm-ventas.ts` (línea 48)

**Pasos.**
1. En `ventas/sync/route.ts`: extraer el cuerpo a `async function correrSync(admin, dry)` y exportar `GET` (solo cron: `requireCron`; si falla → 401) y `POST` (igual que hoy: cron o admin sin setter). Comentar por qué existe el `GET` (Vercel Cron invoca con GET; sin esto el cron daba 405 y nunca sincronizó).
2. `setter-no-book-followup` **se queda en cron-job.org** (resuelto el 19/9: está activo y el plan gratuito de Vercel no permite crons por hora). No agregarlo a `vercel.json`. Dejar en el route un comentario que diga eso, con la fecha.
2b. `leads-followup` (D3b): retirarlo. Borrar la ruta `src/app/api/cron/leads-followup/route.ts` y su entrada en `vercel.json`, y anotar en el commit que el aviso lo cubre `setter-no-book-followup`. Alternativa descartada: correr la migración de mayo para revivirlo, porque duplicaría el aviso y ocuparía un cron en un plan que permite dos. **Antes de borrar nada de `vercel.json`, esperar la lista de crons activos que trae Sebastián** (sección 2.2): con el límite de Hobby hay que elegir qué dos crons importan más (candidatos: `daily-reminder` y `ventas/sync`) y mover el resto a cron-job.org con `CRON_SECRET`, que es lo que ya funciona para el setter.
3. `weekly-insight`: al final, borrar de `notifications` las filas con `leido = true` y `created_at < now() - 90 días`, y las no leídas de más de 180 días. Loguear cuántas. En tandas de 1000 para no pasarse de `maxDuration`.
4. `client-errors/route.ts`: agregar una lista `RUIDO_CONOCIDO` de patrones que se guardan en la tabla pero **no** disparan la notificación a admins: `/Failed to (update|register) a ServiceWorker/`, `/Java (object is gone|exception was raised)/`, `/^Load failed$/`, `/^Failed to fetch$/`, `/^Script error[.]?$/`, `/NetworkError/`. Los errores de chunk (`/Failed to load chunk/`) SÍ notifican (son deploy en curso; ver WP-07).
5. `crm-ventas.ts:48`: reemplazar el `replace` que no hace nada por el mismo de `crm-logs.ts:145`. Escribirlo con el tool de edición, no por heredoc.

**Criterios de aceptación.**
- `curl -s -H "Authorization: Bearer $CRON_SECRET" https://alumno.jiujitsulatino.com/api/admin/ventas/sync?dry=1` devuelve JSON con `dry: true` (el agente NO tiene el secreto: lo prueba Sebastián o se verifica al día siguiente en los logs de Vercel → Cron Jobs, que el job figure con status 200 en vez de 405).
- Insertar un error de prueba con `fetch('/api/client-errors', {method:'POST', body: JSON.stringify({event:'qa.prueba', message:'Load failed'})})` desde la consola del navegador en producción → aparece en `client_errors` y **no** llega notificación. Con `message:'Failed to load chunk x'` → sí llega (a quien tenga la marca "errores"). Borrar las dos filas de prueba al terminar (`delete from client_errors where event='qa.prueba'` — lo hace Sebastián o el agente con el service role, avisando).
- `npx tsc --noEmit` y eslint limpios en los archivos tocados.

**Riesgos.** El `GET` nuevo de ventas debe fallar cerrado sin `CRON_SECRET` (ya lo hace `requireCron`). La limpieza de notificaciones no debe tocar las no leídas recientes: probar primero con `dry` (agregar `?dry=1` al cron semanal para poder invocarlo a mano). No cambiar el horario ni el orden de los crons existentes.

**Dependencias.** Ninguna. Puede ir en paralelo con WP-01.

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Responder pregunta 1 (cron externo). Después del deploy, mirar Vercel → Project → Cron Jobs al día siguiente y confirmar que `/api/admin/ventas/sync` dio 200.

---

### WP-03 — Endpoints públicos del embudo: límite de frecuencia y validación

**Objetivo.** Que nadie pueda inundar el WhatsApp del coach, el webhook de Make ni las tablas desde afuera, y que ningún endpoint público devuelva mensajes de la base.

**Archivos.**
- Nuevo: `supabase/migrations/2026_09_2x_rate_limit.sql` (tabla `api_rate_limits` + función `rate_limit_hit(clave text, limite int, ventana_seg int) returns boolean`, `security definer`, sin políticas: solo service role)
- Nuevo: `src/lib/rate-limit.ts` (`permitir(clave, limite, ventanaSeg): Promise<boolean>`; si la tabla/función no existe, loguea `warn` una vez y **deja pasar**, para no romper la captación si la migración todavía no corrió)
- `src/app/api/leads/quiz/route.ts`, `phone/route.ts`, `near-miss/route.ts`, `calendly-event/route.ts`, `check/route.ts`, `match-quiz/route.ts`, `src/app/api/track-click/route.ts`, `src/app/api/client-errors/route.ts`
- Nuevo: `src/lib/session-id.ts` con `esSessionIdValido(v): v is string` (UUID v4 o el formato `Date.now()-random` que genera `EvaluationQuiz.tsx:254-259` como fallback; aceptar ambos, largo 8–100)

**Pasos.**
1. Migración: tabla `api_rate_limits(clave text primary key, ventana_inicio timestamptz, cuenta int)` y la función que hace upsert atómico y devuelve `true` si `cuenta <= limite`. Comentar en español.
2. `rate-limit.ts`: clave = `${ruta}:${ip}` donde ip sale de `x-forwarded-for` (primer valor) o `x-real-ip`. Límites: `quiz` 30/10 min por IP; `phone` 5/10 min por IP **y** 1 WhatsApp por `session_id` (marcar con la clave `phone-wa:${session_id}`, 24 h); `near-miss` 5/10 min; `calendly-event` 30/10 min; `check` 60/10 min; `match-quiz` 30/10 min; `track-click` 60/10 min; `client-errors` 20/10 min. Respuesta al exceder: 429 `{ error: 'Demasiadas solicitudes' }` **salvo** en `near-miss`, `calendly-event`, `check`, `track-click` y `client-errors`, que responden 200 `{ ok:false }` (son best-effort y el cliente no debe reintentar).
3. Reemplazar las validaciones sueltas de `session_id` por `esSessionIdValido`. En `quiz` y `phone` no devolver `error.message` de Postgres: loguear y devolver `{ error: 'No se pudo guardar' }`.
4. En `phone/route.ts`, bajar `ENRICHMENT_TIMEOUT_MS` a 1500 (el webhook de Calendly llega casi siempre antes; medir con los datos: 106/109 tienen `scheduled_at`) y saltear la espera si ya viene `scheduled_at` y `nombre`.
5. Poner el umbral de rate limit detrás de `process.env.RATE_LIMIT_ENABLED !== '0'` para poder apagarlo desde Vercel sin deploy.

**Criterios de aceptación.**
- Con la migración corrida: 31 POST seguidos a `/api/leads/quiz` con `session_id` inválido desde una misma IP → los primeros 30 dan 400, el 31 da 429. Sin la migración: nunca 429, y un `warn` `rate-limit.sin-tabla` en los logs de Vercel.
- El flujo real completo (`/consultoria-gratuita` → 3 preguntas → Calendly → teléfono) y el de `/agendar` siguen funcionando en producción **en modo prueba** (WP-06; si WP-06 no está, coordinar con Sebastián para que la prueba dispare un solo webhook real y avisarle antes).
- `npx tsc --noEmit` y eslint limpios.

**Riesgos / cómo no romper.** El webhook del formulario (`isInitial`, `quiz/route.ts:80`) no se toca. El `session_id` de fallback (cuando no hay `crypto.randomUUID`) NO es UUID: por eso se acepta el segundo formato; verificar contra `EvaluationQuiz.tsx:254-259` y `AgendaRapida.tsx`. Todo el rate limit falla abierto.

**Dependencias.** Ninguna de código. **Requiere que la migración se corra antes de que el límite haga efecto.**

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Correr `supabase/migrations/2026_09_2x_rate_limit.sql` en el SQL editor de Supabase (crea una tabla y una función; no toca datos). Opcional: `RATE_LIMIT_ENABLED=0` en Vercel si hay que apagarlo.

---

### WP-04 — Medición del embudo desde la base (vistas Looker + ventas + setter)

**Objetivo.** Que Looker Studio lea directo de Postgres: embudo del formulario, del quiz, recuperables, agendas, y **ventas con setter**. Dejar de depender de la pestaña LOOKER.

**Archivos.**
- `supabase/migrations/2026_09_09_vistas_embudo_looker.sql` (no modificar: ya está escrita; se corre)
- Nuevo: `supabase/migrations/2026_09_2x_vistas_ventas_setter.sql`: `v_ventas` (una fila por `lead_sales` con `fecha_venta`, `monto`, `moneda`, `is_fee`, `source`, nombre del alumno o `crm_nombre`, y **setter** = `users.nombre` del `lead_quiz_responses.assigned_to` cuando hay lead) y `v_embudo_mensual` (agregado por mes: leads, agendaron, convertidos, ventas, monto).
- Nuevo: `scripts/embudo-check.mjs` (solo lectura: imprime las 5 vistas de los últimos 30 días para comparar con Looker/CRM)
- `src/lib/calendly.ts:6-9`: corregir el comentario (el webhook funciona desde agosto)
- Nuevo: `docs/looker.md` (cómo conectar: host, base, usuario de solo lectura, qué vista es cada gráfico, la nota del 29/8 sobre `vieron_calendario`)

**Pasos.**
1. Escribir la migración de ventas. Las vistas heredan RLS; el usuario de Looker se crea con `create role looker login password '...'` + `grant select on v_* to looker` — **eso lo escribe Sebastián** (la contraseña no va en el repo). Dejar el SQL con `'<PASSWORD>'` como placeholder en `docs/looker.md`, no en la migración.
2. Script `embudo-check.mjs` leyendo `.env.local` (mismo patrón que `scripts/check-schema.mjs`). Solo `select`.
3. Correr el script después de que Sebastián corra las migraciones y pegar el resultado en el mensaje final (sin nombres de personas).

**Criterios de aceptación.**
- `node scripts/embudo-check.mjs` imprime filas de las 6 vistas sin error.
- `v_ventas` muestra las 28 filas actuales de `lead_sales` (21 `crm`, 6 `crm_ventas`, 1 `manual`) con setter donde hay `assigned_to`.
- Looker conectado por Sebastián (fuera del alcance del agente).

**Riesgos.** Ninguno de datos (solo vistas). Si `v_ventas` exige columnas que no existen, la migración falla entera: probar cada `create view` por separado en el SQL editor.

**Dependencias.** Ninguna. Conviene después de WP-02 (para que `lead_sales` esté al día).

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** (1) Correr `2026_09_09_vistas_embudo_looker.sql`. (2) Correr `2026_09_2x_vistas_ventas_setter.sql`. (3) Crear el usuario de solo lectura con el SQL de `docs/looker.md`. (4) Conectar Looker.

---

### WP-05 — Recuperar los handles de Instagram corruptos (29/8 a 9/9)

**Objetivo.** Corregir en `lead_quiz_responses.instagram` los handles a los que el bug les sacó las "s", con respaldo y sin adivinar.

**Archivos.**
- Nuevo: `scripts/recuperar-handles.mjs` con `--dry` (default) y `--aplicar`
- Fuentes: `lead_quiz_responses.referrer` (34 filas con `?ig=`), API de Calendly (`src/lib/calendly.ts` ya tiene `buscarPorEmail`; la pregunta `a4` guarda `@handle` — ver `calendly-url.ts:22`), y `match_quiz_responses.instagram` (el quiz de luchador no tuvo el bug; matchear por `whatsapp`/`nombre` si coincide con `telefono`/`nombre` del lead)

**Pasos.**
1. Rango: `created_at` entre `2026-08-29` y `2026-09-10` (58 filas). Para cada una, calcular candidatos: `ig` del referrer; `a4` de Calendly (solo si el lead tiene `email` y la búsqueda devuelve una sola consultoría); `instagram` del quiz de luchador (misma persona por teléfono).
2. Regla de confianza: se aplica solo si (a) el candidato, al sacarle las "s", da exactamente el valor guardado (o el valor guardado es un prefijo/sufijo obvio), y (b) todas las fuentes disponibles coinciden. Si no, va al informe.
3. `--dry`: imprime tabla `session_id | guardado | candidato | fuente | acción`. `--aplicar`: primero escribe `scripts/backups/handles-backup-<fecha>.json` con las filas originales, después hace los `update`, y escribe una nota en `lead_contacts` (`canal:'otro'`, `nota:'Handle corregido automáticamente: X → Y (fuente: referrer)'`) para que quede trazado en el drawer.
4. Informe para el setter: `scratchpad/handles-a-revisar.csv` con las filas sin candidato seguro (esperable: ~30). Sebastián decide qué hacer con eso.

**Criterios de aceptación.**
- `--dry` muestra al menos los 13 casos con handle distinto al del referrer (verificado el 19/9) y no propone nada fuera del rango de fechas.
- `--aplicar` solo después de que Sebastián apruebe el listado del dry-run.
- Después de aplicar: `select count(*) from lead_quiz_responses where created_at between ... and instagram like '%s%'` sube respecto de hoy (hoy: 7 de 58); ninguna fila fuera del rango cambió (comparar `updated_at`/contenido contra el backup).

**Riesgos.** Cambiar un handle mal es peor que dejarlo. Por eso nada se aplica sin las dos condiciones y sin aprobación. No tocar `match_quiz_responses`. El token de Calendly (`CALENDLY_TOKEN`) no está en `.env.local`: si Sebastián no lo pasa como variable de entorno al correr el script, la fuente Calendly se saltea y se dice en el informe.

**Dependencias.** Ninguna. Mejor después de WP-03 (nada que ver técnicamente; es solo prioridad).

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Aprobar el dry-run. Opcional: pasar `CALENDLY_TOKEN` al correr el script.

---

### WP-06 — Contrato del embudo: una sola fuente de valores, asserts y modo prueba

**Objetivo.** Que el quiz largo, `/agendar`, las etiquetas del panel, el webhook y las notificaciones no puedan volver a desalinearse en silencio; y poder probar el embudo en producción sin disparar Make ni WhatsApp.

**Archivos.**
- `src/lib/lead-labels.ts` (pasa a ser la fuente única: exportar también `OPCIONES_COMPROMISO`, `OPCIONES_URGENCIA`, `OPCIONES_OCUPACION`, `OPCIONES_LIMITACION` con `{ value, label, hidesCalendar?, disqualifies? }`)
- `src/components/consultoria/EvaluationQuiz.tsx` y `src/components/agendar/AgendaRapida.tsx` (importar las opciones en vez de repetirlas; el texto largo de cada pantalla puede seguir siendo local, pero el `value` viene de `lead-labels`)
- `src/app/api/leads/quiz/route.ts`, `phone/route.ts`, `near-miss/route.ts`, `src/lib/lead-webhook.ts`
- `src/app/api/admin/leads/route.ts` y `src/components/admin/setter/Kanban.tsx` (ocultar leads de prueba)
- Nuevo: `scripts/check-embudo.ts` (asserts, corre con `npx tsx`)
- Nuevo: `scripts/limpiar-leads-qa.mjs`

**Pasos.**
1. Mover las opciones a `lead-labels.ts`. Los dos formularios las importan. `AgendaRapida` hoy repite 'serio/moderado/viendo', 'estable/inestable/jubilado', 'si/no' (`AgendaRapida.tsx:43-67`); `EvaluationQuiz` las tiene en `QUESTIONS`. Después del cambio, cada `value` existe una sola vez en el repo.
2. **Modo prueba.** Los POST a `/api/leads/quiz`, `/phone`, `/near-miss` aceptan `qa: true` en el body. Con `qa: true`: se guarda la fila con `user_agent = 'JJL-QA/1 ' + userAgent` y **no** se llama a `dispatchLeadWebhook`, `notifyCoachWhatsApp` ni `fanOutLeadNotifications`. El front lo activa con `?qa=1` en la URL de `/consultoria-gratuita` y `/agendar` (guardarlo en el estado junto al `session_id`; **no** propagarlo a Calendly: ahí se agenda de verdad, así que en modo prueba el paso Calendly se muestra con un cartel "MODO PRUEBA: no agendes" y el cliente no llama a `/api/leads/calendly-event`).
3. `/api/admin/leads` filtra `user_agent not like 'JJL-QA%'` salvo `?incluirQa=1`. El Kanban no cambia.
4. `scripts/check-embudo.ts` con asserts:
   - todos los `value` de las opciones tienen etiqueta en `COMPROMISO_LABEL`, `URGENCIA_LABEL`, etc.;
   - los campos que `quiz/route.ts` exige para `isInitial` (`compromiso`, `urgencia`) están en las preguntas obligatorias de **los dos** formularios (leer el módulo, no parsear texto);
   - `LeadWebhookPayload` tiene las claves que Make espera (lista fija en el script; si alguien saca una clave, el assert falla);
   - `withSession(url, id, ig)` produce `utm_content` y `a4`.
5. `scripts/limpiar-leads-qa.mjs`: borra `lead_quiz_responses` con `user_agent like 'JJL-QA%'` y sus `lead_contacts`; imprime cuántas.

**Criterios de aceptación.**
- `npx tsx scripts/check-embudo.ts` → "OK".
- En producción con `?qa=1`: completar `/consultoria-gratuita` y `/agendar` de punta a punta (sin agendar en Calendly). La fila aparece en la base con `JJL-QA`, **no** llega WhatsApp, **no** aparece en el Kanban, y en los logs de Vercel hay `lead.webhook.skipped` con `reason: 'qa'`.
- Sin `?qa=1` todo sigue igual: un envío real dispara el webhook (**coordinar con Sebastián**: una sola prueba real, avisando antes y borrando la fila después).
- `npx tsc --noEmit` y eslint limpios en los archivos tocados.

**Riesgos / cómo no romper.** Este paquete toca el webhook. La regla es: `isInitial` no cambia de definición; `dispatchLeadWebhook` solo gana un early-return por `qa`. Diff mínimo en `quiz/route.ts`. Antes de mergear, correr el script de asserts y un envío real con aviso.

**Dependencias.** WP-03 (ambos tocan las mismas rutas; hacer WP-03 primero para no pelear el diff).

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Aceptar un envío real de prueba al webhook (o mirar en Make que llegue) y borrar la fila después.

---

### WP-07 — Resiliencia en el celular (lado cliente)

**Objetivo.** Que un deploy no deje a nadie con "Algo salió mal", y que la red mala del celular no se reporte como error.

**Archivos.**
- `src/app/error.tsx`
- `src/lib/logger.ts`
- `src/components/VersionCheck.tsx`
- `src/components/PushPrompt.tsx` (donde se reporta `push.saveSubscription.failed`) y el check-in del dashboard (buscar `dashboard.checkin.failed` con grep; hoy vive en `src/components/dashboard/TaskDashboard.tsx` o `src/app/(dashboard)/dashboard/page.tsx`)

**Pasos.**
1. `error.tsx`: detectar `/Failed to load chunk|ChunkLoadError|Loading chunk/`. Si es eso y `sessionStorage.getItem('jjl-recarga-chunk') !== '1'`: setear la marca y `window.location.reload()` (una sola vez; si vuelve a fallar, mostrar la pantalla con botón "Actualizar"). Mostrar "Hay una versión nueva, actualizando…" mientras recarga.
2. `logger.ts`: en `reportToServer`, tratar como ruido (no reportar) los mensajes `Load failed`, `Failed to fetch`, `NetworkError`, `The network connection was lost`, `Failed to update a ServiceWorker`, `Java object is gone`, `Java exception was raised`. Mantener el log en consola.
3. Push y check-in: donde se hace el `fetch`, reintentar una vez con 1,5 s de espera si el error es de red; si sigue fallando, `logger.warn` (no `error`) y un toast "Sin conexión, probá de nuevo".
4. `VersionCheck`: cuando detecta versión nueva **y** el usuario no está escribiendo (no hay `textarea`/`input` con foco y sin cambios en los últimos 10 s), recargar sola a los 30 s; si está escribiendo, dejar el banner como hoy.

**Criterios de aceptación.**
- Simulación local: `npm run dev`, abrir `/modules`, en DevTools → Network bloquear un chunk `_next/static/chunks/*.js` de una página no visitada, navegar a ella → la app recarga sola una vez, no muestra "Algo salió mal".
- En producción, `client_errors` de los 7 días posteriores al deploy no contiene ninguno de los mensajes de ruido (consulta de solo lectura).
- `npx tsc --noEmit` y eslint limpios.

**Riesgos.** Un bucle de recarga: por eso la marca en `sessionStorage`. No tocar `public/sw.js` (funciona y ya tuvo un incidente).

**Dependencias.** Ninguna. Complementa WP-02.

**Acción manual.** Ninguna.

---

### WP-08 — Curso: alinear el Mes 2 de los alumnos viejos sin perder progreso

**Objetivo.** Que todos los alumnos tengan `course_data` de las semanas 5–8 con el mismo orden y títulos que `src/lib/planillas.ts`, que `user_access` exista para cada módulo, y que el merge de overrides sea UNA función.

**Archivos.**
- Nuevo: `scripts/diagnostico-mes2.mjs` (solo lectura) y `scripts/alinear-mes2.mjs` (`--dry` / `--aplicar`, con backup)
- Nuevo: `src/lib/course-merge.ts` (función `aplicarOverrides(moduleId, lessons, overrides, planillaYt)` usada por `course-data/route.ts`, `sync-planillas/route.ts` y `update-lesson-video/route.ts`)
- `src/app/api/course-data/route.ts`, `src/app/api/admin/sync-planillas/route.ts`, `src/app/api/admin/update-lesson-video/route.ts`

**Pasos.**
1. Diagnóstico (solo lectura): para cada alumno, comparar `course_data` sem 5–8 contra `getPlanillaForSave(planilla_id)`; listar alumnos con títulos distintos; para cada uno, listar `user_progress.lesson_id` que **no** existan en la planilla nueva y proponer mapeo por título normalizado (misma función `normTitle` de `admin-videos.ts`). Imprimir también módulos sin fila en `user_access`.
2. Alineación (`--aplicar` solo con aprobación): backup JSON de `course_data`, `user_progress` y `user_access` de los alumnos afectados en `scripts/backups/`; luego, por alumno: upsert de las 4 filas de Mes 2 con las lecciones de la planilla + overrides (usar `course-merge.ts`), reescribir `user_progress.lesson_id` según el mapeo por título (donde hay match único), crear `user_access` faltantes con `is_unlocked` = el que tenía el módulo viejo del mismo `semana_numero` (o `false`).
3. Refactor: mover el merge a `course-merge.ts` y que los tres endpoints lo usen. Sin cambiar comportamiento; el objetivo es un solo lugar. Mantener el fallback por título de `course-data/route.ts:124-130` (los overrides viejos siguen con `module_id` del orden anterior).

**Criterios de aceptación.**
- `node scripts/diagnostico-mes2.mjs` después de aplicar: 0 alumnos con títulos distintos en sem 5–8, 0 módulos sin `user_access`.
- Puntos y cinturón de cada alumno afectado no bajan (comparar `dashboard-stats` antes/después para 3 alumnos: `puntos`, lecciones completadas).
- En `/admin/videos`, las semanas 5–8 muestran los mismos videos que antes del cambio (capturar pantalla antes y después).
- Un alumno con orden viejo (elegir uno con Sebastián) ve en `/modules` los módulos 5–8 con el orden nuevo y sus lecciones completadas siguen marcadas.

**Riesgos.** Es el paquete más delicado: toca progreso de alumnos. Por eso: dry-run obligatorio, backup, aprobación, y aplicar primero a **un** alumno, verificar, después al resto. Nunca borrar `user_progress`; solo actualizar `lesson_id` cuando el mapeo es unívoco.

**Dependencias.** Ninguna de código. Requiere aprobación del dry-run (pregunta 3).

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Aprobar el dry-run y elegir el alumno piloto.

---

### WP-09 — Lint a cero, typecheck, y CI en GitHub

**Objetivo.** Que `npx eslint src` y `npx tsc --noEmit` terminen en 0 y que GitHub lo verifique en cada push.

**Archivos.**
- `package.json` (scripts `typecheck`, `lint:ci`)
- Nuevo: `.github/workflows/ci.yml` (Node 20, `npm ci`, `npm run typecheck`, `npm run lint:ci`)
- Los 87 archivos con problemas; empezar por los de más errores: `src/app/api/community/posts/route.ts` (19, todos `any` → tipar `PostRow`, `UserRow`, `PollRow`, `VoteRow`; **y** de paso filtrar `post_poll_votes` por `poll_id in (...)`, ver D11), `posts/[postId]/route.ts`, `admin/analytics/route.ts`, `skills/route.ts`, `messages/route.ts`, `events/route.ts`, `leaderboard/route.ts`, `src/lib/planillas.ts:1104-1139` (`require` → import), `src/components/consultoria/EvaluationQuiz.tsx` (imports sin usar).
- `src/components/video/CustomVideoPlayer.tsx`: **no refactorizar**. Mover `createPlayer` arriba del `useEffect` (arregla `immutability` sin cambiar lógica), reemplazar `Math.random()` en render por `useId()`/`useRef`, y para el resto poner `// eslint-disable-next-line <regla> -- <porqué en español>` línea por línea. Es el componente más frágil (iOS fullscreen) y no hay tests.

**Pasos.**
1. Borrar `.next/dev/types` (o `.next` entero) para sacar el error fantasma de `r/prueba-video-tmp` (D13). Verificar que `src/app/r/prueba-video-tmp` no existe.
2. `package.json`: `"typecheck": "tsc --noEmit"`, `"lint:ci": "eslint src --max-warnings=200"` (los warnings se bajan después; los errores tienen que ser 0).
3. Tipar los `any` archivo por archivo, corriendo `npx eslint <archivo>` y `npx tsc --noEmit` después de cada uno. Commits chicos (uno por 3–5 archivos).
4. `ci.yml` sin secretos: solo tipos y lint. No corre build (necesita envs).

**Criterios de aceptación.**
- `npm run typecheck` → 0 errores. `npm run lint:ci` → 0 errores.
- El workflow pasa en verde en GitHub para el commit final.
- Producción: `/community` (feed, encuestas, likes), `/modules/mod-1` (reproducir video, fullscreen en iPhone y Android), `/admin/analytics`, `/leaderboard`, `/events`, `/chat` funcionan igual que antes (checklist manual, sección 5).

**Riesgos.** Tipar `any` cambia comportamiento si se "arregla" un `?.`; la regla es: solo tipos y disables comentados, nada de lógica. El reproductor se prueba en dos celulares reales.

**Dependencias.** Después de WP-01/02/03/06/07 (para no tipar archivos que otros paquetes están cambiando). Puede empezar por archivos que nadie más toca (`analytics`, `skills`, `messages`, `events`, `leaderboard`, `planillas.ts`).

**Acción manual.** Ninguna (GitHub Actions viene activado por default en el repo; si estuviera desactivado, Sebastián lo activa en Settings → Actions).

---

### WP-10 — QA automatizado: smoke tests + tarea programada

**Objetivo.** Un recorrido automático que detecte roturas obvias antes de que avise un alumno, y una tarea semanal que haga QA exploratorio como alumno/lead/setter.

**Archivos.**
- Nuevo: `tests/smoke/*.spec.ts` con Playwright (`npm i -D @playwright/test`; `npx playwright install chromium`)
- Nuevo: `playwright.config.ts` (base URL por env: `QA_BASE_URL`, default `http://localhost:3000`; `QA_ALUMNO_EMAIL/PASSWORD`, `QA_SETTER_EMAIL/PASSWORD` por env, nunca en el repo)
- `package.json`: `"test:smoke": "playwright test"`
- Nuevo: `docs/qa.md` con el prompt de la tarea programada (texto que Sebastián pega al crearla)

**Pasos.**
1. Tests anónimos (no necesitan cuentas): `/` carga y tiene "Iniciar Sesion"; `/que-luchador-sos` completa el quiz con `?qa=1` (usa el modo prueba de WP-06 para `match-quiz`: agregar `qa` ahí también) y llega a la ficha; `/agendar?qa=1` responde 3 preguntas y muestra el calendario o el mensaje sin calendario; `/consultoria-gratuita?qa=1` completa el formulario; `/login` muestra el form; `/sw.js` responde `CACHE_NAME`; `/api/version` responde JSON; `/api/admin/leads` sin sesión → 403/401.
2. Tests con cuenta de alumno de prueba: login, `/dashboard` sin error boundary, `/modules` lista módulos, `/modules/mod-intro` carga el reproductor, `/journal` guarda una entrada y la borra, `/community` lista posts (no publica).
3. Test con cuenta setter de prueba: `/admin/agendas` carga Kanban, `/admin/analytics` redirige/403.
4. Al final: `node scripts/limpiar-leads-qa.mjs`.
5. `docs/qa.md`: prompt para la tarea programada (semanal, lunes 9:00 AR): "Recorré https://alumno.jiujitsulatino.com como lead (con `?qa=1`), como alumno (credenciales X) y como setter (credenciales Y). Buscá errores en consola, pantallas rotas, textos mal, botones que no hacen nada, y cualquier cosa que un lead pueda ver y no deba. Informá en español rioplatense: qué anduvo, qué no, con captura y pasos. No publiques en la comunidad, no agendes en Calendly, no cambies datos de alumnos reales. Al terminar corré la limpieza de leads QA." La tarea la crea Sebastián (es configuración persistente).

**Criterios de aceptación.**
- `QA_BASE_URL=https://alumno.jiujitsulatino.com npm run test:smoke` pasa en verde (con las credenciales de prueba en variables de entorno de la sesión, no en archivos).
- Ningún test dispara webhook/WhatsApp (todos con `qa`).
- La tarea programada corre una vez y entrega un informe legible.

**Riesgos.** Cuentas de prueba con datos reales: tienen que ser cuentas nuevas, `program_member=true` para el alumno QA, y el setter QA con `rol='alumno'` + tag `setter` (así no puede escalar). Los tests no crean posts ni eventos.

**Dependencias.** WP-06 (modo prueba). WP-09 (CI) opcional: los smoke tests **no** van al CI de GitHub (necesitan credenciales); se corren a mano o desde la tarea programada.

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Crear 2 usuarios de prueba desde `/admin` (alumno QA y setter QA) y pasar las credenciales por un canal seguro (no por chat de agente). Crear la tarea programada con el prompt de `docs/qa.md`.

---

### WP-11 — Documentación y limpieza

**Objetivo.** Que el próximo agente arranque con la verdad.

**Archivos.** `CLAUDE.md`, `README.md`, `AGENTS.md`, `scripts/` (mover los one-off de mayo/junio a `scripts/archivo/` con un `README` de una línea cada uno), borrar `CLAUDE.md.bak` y `docs/superpowers/plans/*.bak`, `src/lib/calendly.ts` (comentario), `src/lib/course-data.ts` (import sin usar), ramas remotas `comunidad-media` y `quiz-luchador-rebalance` (solo si Sebastián confirma que no tienen nada).

**Pasos.**
1. Reescribir `CLAUDE.md` en español: stack real, tablas reales (`lead_quiz_responses`, `match_quiz_responses`, `lead_sales`, `lead_contacts`, `crm_followups`, `client_errors`, `lesson_video_overrides`, `api_rate_limits`, cursos), roles y tags, crons con horario, endpoints públicos y su modo prueba, cómo verificar un deploy, la sección 6 de este plan como "Reglas".
2. `README.md`: 20 líneas: qué es, cómo correr, cómo verificar, dónde están las migraciones y quién las corre.
3. Agregar a `.gitignore`: `scripts/backups/`.

**Criterios.** Un agente nuevo puede, leyendo solo `CLAUDE.md`, saber qué no tocar y cómo verificar. Nada de código cambia.

**Dependencias.** Último de todos.

**Acción manual.** **[ACCIÓN DE SEBASTIÁN]** Confirmar borrado de las 2 ramas.

---

## 5. Orden de ejecución y estrategia de release

### Orden

```
Semana 1 (serie):    WP-01 ──► deploy ──► Sebastián prueba como setter
Semana 1 (paralelo): WP-02   WP-07   WP-04 (Sebastián corre migraciones)
Semana 2 (serie):    WP-03 ──► WP-06 ──► (envío real de prueba con aviso)
Semana 2 (paralelo): WP-05 (dry-run → aprobación → aplicar)
Semana 3:            WP-08 (dry-run → piloto → resto)   WP-09 (lint/CI)
Semana 4:            WP-10 (QA) ──► WP-11 (docs)
```

- **En serie sí o sí:** WP-01 antes que nada (seguridad). WP-03 antes que WP-06 (mismas rutas). WP-06 antes que WP-10 (el QA usa el modo prueba). WP-09 después de que los demás paquetes de código hayan mergeado (para no tipar archivos en movimiento). WP-11 al final.
- **En paralelo sin conflicto:** WP-02, WP-04, WP-05, WP-07, WP-08 no comparten archivos con nadie salvo WP-04/WP-02 (`lead_sales`, solo datos).

### Rama o commits a main

Seguir con **commits chicos a main** (es lo que el equipo ya sabe hacer y el deploy automático está probado), con tres reglas nuevas:
1. Un paquete = 1 a 3 commits, y cada commit deja la app funcionando (no se pushea "a medias").
2. Los paquetes de **datos** (WP-05, WP-08) no llevan deploy: son scripts que se corren a mano con aprobación. Solo el refactor de WP-08 (`course-merge.ts`) se pushea, y después de aplicar los datos.
3. Nada se pushea entre las 18:00 y las 23:00 hora Argentina (horario de uso de los alumnos según el cron de recordatorio y las sesiones) salvo hotfix.

No hace falta rama de release. Sí conviene **una rama por paquete** localmente (`wp-01-permisos`) y merge fast-forward a main cuando pasa el checklist; así un paquete a medias no bloquea a otro.

### Feature flags

- `RATE_LIMIT_ENABLED` (WP-03): apagable desde Vercel sin deploy.
- Modo prueba `?qa=1` / `qa: true` (WP-06): no es un flag, es un camino separado.
- Recarga automática de `VersionCheck` (WP-07): constante `RECARGA_AUTOMATICA = true` al principio del archivo, para poder apagarla con un commit de una línea.

### Checklist de QA antes de cada deploy (lo hace el agente, en local con `npm run dev`)

1. `npx tsc --noEmit` → 0 errores. `npx eslint <archivos tocados>` → 0 errores.
2. Como admin: `/dashboard`, `/modules/mod-1` (video), `/journal` (guardar), `/community` (ver), `/admin` (lista), `/admin/agendas` (Kanban + drawer), `/admin/videos` (semana 5).
3. Anónimo: `/consultoria-gratuita?qa=1` completa; `/agendar?qa=1` completa; `/que-luchador-sos` llega a la ficha.
4. Si el paquete toca `/api/leads/*` o `lead-webhook.ts`: `npx tsx scripts/check-embudo.ts` (desde WP-06) y **avisar a Sebastián** que se va a hacer un envío real.
5. Si toca permisos: `npx tsx scripts/check-permisos.ts`.
6. `git status` limpio (nada temporal, `public/sw.js` sin cambios).

**Después del deploy (2–5 minutos):** `curl -s https://alumno.jiujitsulatino.com/sw.js | grep CACHE_NAME` muestra `jjl-<sha8>` del commit; `curl -s https://alumno.jiujitsulatino.com/api/version` coincide; abrir la home y una pantalla del paquete en producción.

### Cómo volver atrás

- **Código:** `git revert <sha> && git push` (2–3 minutos hasta producción). Alternativa inmediata: Vercel → Deployments → el anterior → "Promote to Production" (**lo hace Sebastián**, es instantáneo). Los agentes no tienen acceso a Vercel: si algo sale mal, revert.
- **Base:** todas las migraciones de v2 son aditivas (vistas, una tabla nueva, una función). Se deshacen con `drop view/table/function`. Ninguna altera columnas existentes.
- **Datos (WP-05, WP-08):** cada script escribe un backup JSON antes de aplicar y tiene `--restaurar <archivo>`. El backup vive en `scripts/backups/` (ignorado por git).

---

## 6. Reglas para los agentes Opus

(Pegar tal cual en cada sesión.)

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

---

## 7. Preguntas para Sebastián

1. ~~**El aviso al setter de "llenó el quiz y no agendó"**~~ *Respondida el 19/9: sigue activo en cron-job.org y se queda ahí (Vercel es plan gratuito, no permite crons por hora).*

2. **Handles de Instagram rotos.** ¿Aprobás que el script corrija en la base solo los casos donde el link original (`?ig=`) o Calendly confirman el handle, y que el resto te llegue como lista para el setter? **Recomendación:** sí; adivinar dónde iban las "s" es peor que dejarlo.

3. **Mes 2 de los alumnos viejos.** Hay alumnos con el orden anterior (Kimura/Armbar antes que Escapes). ¿Los alineamos con el orden nuevo (con backup, piloto en un alumno y sin borrar progreso), o los dejamos con el orden que ya conocen y solo arreglamos el editor? **Recomendación:** alinear; cada parche por título que hay hoy es un bug esperando.

4. **QA automatizado.** Necesita dos cuentas de prueba (un alumno QA y un setter QA, creados desde `/admin`) y que vos crees la tarea programada semanal con el prompt que te dejamos. ¿Va? **Recomendación:** sí, y que el informe te llegue los lunes a la mañana.

5. **Agendas que carga el equipo directo en Calendly** (21 de 47 en el período que mediste) no existen en la app, y por eso el Kanban y el embudo se ven peor de lo que son. ¿Querés que en v2 (paquete extra, después de WP-04) esas consultorías entren al Kanban como leads "por DM" usando la lectura de Calendly que ya existe? **Recomendación:** sí, pero como paquete aparte y después de que las vistas de Looker estén andando; no lo metería en esta tanda.


### Respuestas de Sebastián (19/9)

- **1 (cron externo):** sigue activo. Se queda en cron-job.org. Avisó que Vercel es plan gratuito: ver 2.2 y WP-02.
- **2 (handles):** aprueba corregir los 13 seguros. Pidió que se le explique mejor qué pasa con el resto (pendiente de reformular).
- **3 (Mes 2):** no entendió la pregunta. Pendiente de reformular antes de WP-08; hasta entonces WP-08 no arranca.
- **4 (QA):** "mandale". Aceptado, aunque pidió que se le explique qué se va a hacer: crear 2 cuentas de prueba y una tarea semanal que recorre la app.
- **5 (agendas fuera de la app):** sí, pero aclara que las agendas salen sobre todo del CRM de ventas, y también de WhatsApp (conectado a Trello). La fuente para traerlas no es solo Calendly: el paquete extra tiene que leer el CRM (pestañas `CRM Agendas` / `LOG_AGENDAS`) y Trello. Sigue fuera de esta tanda.

---

## Archivos críticos

- `src/lib/supabase/middleware.ts` — el gate de setter que hay que aplicar en los dos hosts (WP-01)
- `src/lib/supabase/server.ts` — `requireAdmin` debe fallar cerrado con setters (WP-01)
- `src/app/api/leads/quiz/route.ts` — punto único donde vive `isInitial` y el disparo del webhook; lo tocan WP-03 y WP-06
- `src/app/api/admin/ventas/sync/route.ts` — el cron roto por falta de `GET` (WP-02)
- `src/app/api/course-data/route.ts` — el merge de overrides por título que WP-08 unifica sin cambiar comportamiento

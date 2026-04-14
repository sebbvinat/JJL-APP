# Onboarding Tour — Diseño

**Fecha:** 2026-04-14
**Contexto:** Piloto con 15+ alumnos en el próximo mes. La app es carta de presentación de un programa de coaching de $900 USD. El hand-off hoy es por WhatsApp con credenciales manuales — primer click dentro de la app es el momento de la verdad.

## Objetivo

La primera vez que un alumno entra, en vez de caer al dashboard vacío, hace un tour guiado de 5 pasos que:
1. Le hace cambiar la contraseña temporal.
2. Le muestra dónde está su programa de módulos.
3. Le explica qué es el diario y cómo usarlo.
4. Le pide activar notificaciones.
5. Lo invita a presentarse en la comunidad.

Al terminar, cae al dashboard con banner "Día 1 de 180 — empezaste el {fecha}".

Los alumnos existentes **y los admins** también pasan por el tour la próxima vez que entren. Admin pasa para que el coach vea la experiencia tal cual la ve su alumno — además, su post de presentación siembra actividad en el foro antes del onboarding de los alumnos.

## Flujo del usuario

Gate: al hacer login, si `onboarding_completed_at IS NULL`, la app lo redirige a `/bienvenida`. No hay escape por URL directa — middleware lo intercepta.

Los 5 pasos:

| # | Paso | Qué ve | Acción requerida |
|---|------|--------|------------------|
| 1 | Bienvenida | Mensaje que enmarca el desafío de 180 días + por qué compartir el progreso hace al alumno y al equipo más fuertes, seguido del cambio de contraseña | Password nuevo (min 8) |
| 2 | Tu programa | Lista de sus módulos asignados | Siguiente |
| 3 | Tu diario | Explicación de qué es y cómo funciona | Siguiente |
| 4 | Notificaciones | Botón "Activar" | Click (o rechazar, no bloquea) |
| 5 | Presentate | Plantilla pre-llenada, publica post | Publicar (o skip si ya tiene post previo) |

Obligatorios: paso 1 siempre. Paso 5 es obligatorio para alumnos sin post previo; si ya existe un post del usuario, el paso 5 ofrece skip explícito. Pasos 2, 3 y 4 son siempre skippables.

**Persistencia:** cada paso completado escribe a DB inmediatamente. Si cierran el browser a mitad, al volver entran al paso donde quedaron.

**Casos borde:**
- Admin sin módulos asignados → el paso 2 le muestra "Desde acá tus alumnos van a ver su programa" + Siguiente. No se equivoca pensando que falta algo.
- Módulos no cargados todavía (alumno) → paso 2 muestra "Tu instructor está armando tu programa. Te avisamos cuando esté listo." + Siguiente habilitado.
- Alumno rechaza permiso de notifs → el paso se da por visto, avanza al 5.
- Usuario existente con post previo → paso 5 ofrece "Ya te presentaste. ¿Querés actualizar?" con skip explícito.

## Arquitectura

### Schema

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

Dos columnas en `users`:
- `onboarding_step` — dónde quedó (1-5).
- `onboarding_completed_at` — NULL hasta terminar el paso 5.

**Sin backfill automático.** Todos los usuarios existentes (alumnos y admin) verán el tour la próxima vez que entren.

### Middleware (gate)

En `src/lib/supabase/middleware.ts`, después del auth check ya existente:

```
Si hay user autenticado Y users.onboarding_completed_at IS NULL
   Y path != '/bienvenida' Y !path.startsWith('/auth/'):
  → redirect a /bienvenida

Si está en /bienvenida Y onboarding_completed_at no es NULL:
  → redirect a /dashboard
```

Admin no está exceptuado — pasa por el tour igual que los alumnos.

Notas:
- El matcher del middleware (`src/middleware.ts`) ya excluye `/api/*`, assets y archivos estáticos, así que no hace falta listarlos.
- `/auth/*` sí pasa por middleware (lo usan OAuth callback y password reset). Lo excluimos explícitamente para no romper esos flows.
- El middleware hoy ya consulta `users.rol` para el gate de `/admin`. Ampliamos esa query para traer también `onboarding_completed_at` en la misma vuelta, sin sumar queries.

### Rutas y archivos

Nueva ruta `/bienvenida` fuera del grupo `(dashboard)` para evitar heredar sidebar/topbar.

| Archivo | Rol |
|---------|-----|
| `src/app/bienvenida/layout.tsx` | Layout fullscreen oscuro, sin chrome |
| `src/app/bienvenida/page.tsx` | Orquestador. Lee `onboarding_step` del usuario y renderiza el paso correspondiente |
| `src/components/onboarding/Shell.tsx` | Progress bar arriba (`N de 5`), área de contenido, botón "Siguiente" y "Después" |
| `src/components/onboarding/Step1Welcome.tsx` | Saludo + form de password |
| `src/components/onboarding/Step2Program.tsx` | Fetch a `/api/course-data?all=true`, lista los módulos |
| `src/components/onboarding/Step3Journal.tsx` | Texto + mini-mockup estático del diario |
| `src/components/onboarding/Step4Notifications.tsx` | Botón Activar → `Notification.requestPermission` + subscribe |
| `src/components/onboarding/Step5Introduction.tsx` | Form con plantilla pre-llenada, publica via `/api/community/posts` |
| `src/app/api/onboarding/step/route.ts` | POST que avanza `onboarding_step` o setea `onboarding_completed_at` |

### APIs

Una sola API nueva:

- **POST `/api/onboarding/step`**
  - Body: `{ step: number, complete?: boolean }`
  - Si `complete === true` → set `onboarding_completed_at = NOW()`.
  - Si no → set `onboarding_step = step`.
  - Protegido por auth (usa `getAuthedUser`).

Reuso de lo existente:
- Password change → cliente Supabase en el browser (igual que `/profile`).
- Push subscribe → `/api/push/subscribe` ya existe.
- Publicar post → `/api/community/posts` ya existe.
- Listar módulos → `/api/course-data?all=true` ya existe.

### Dashboard welcome banner (post-onboarding)

Pequeño cambio en `src/app/(dashboard)/dashboard/page.tsx`: si hay `users.onboarding_completed_at` y el `created_at` del usuario es reciente (< 180 días), mostrar una línea sutil en el welcome banner: "Día N de 180 — empezaste el {fecha}". Ayuda a anclar la experiencia al programa.

## Estado final después de implementar

- 1 migration nueva en `supabase/migrations/`.
- 1 API route nueva (`/api/onboarding/step`).
- 1 route nueva completa (`/bienvenida` con su layout).
- 6 componentes nuevos en `src/components/onboarding/`.
- 2 archivos existentes modificados: `middleware.ts` (gate) y `dashboard/page.tsx` (banner).

## Lo que queda fuera del scope

- Copy / redacción final de los textos de cada paso (los pongo placeholder; el coach los edita después si quiere).
- Video del coach en paso 1 (opcional, se puede agregar vía env var o admin config después).
- Analytics de completación / abandono por paso (se puede agregar con Sentry o similar después).
- Personalización del tour por tipo de alumno (todos reciben el mismo).
- Onboarding en mobile nativo (la PWA cubre mobile web, que es suficiente para el piloto).

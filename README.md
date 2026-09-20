# JJL App — Jiu Jitsu Latino

Un solo proyecto Next.js 16 + Supabase que sirve dos productos según el dominio: la plataforma de alumnos del programa de 6 meses, con su panel de admin/setter y las landings del embudo de ventas (`alumno.jiujitsulatino.com`), y la tienda de cursos sueltos (`jiujitsulatino.com`). Se despliega en Vercel (plan gratuito): **cada push a `main` sale a producción**, no hay staging.

**Antes de tocar nada leé `CLAUDE.md`** (mapa del código, tablas reales, permisos, crons, zonas sensibles y reglas) y `AGENTS.md`. El plan de la v2 está en `docs/plan-v2.md`.

## Cómo correr

```
npm install
npm run dev        # http://localhost:3000 — la tienda de cursos se ve en /cursos
```

Hace falta un `.env.local` con las claves de Supabase (lista de variables en `CLAUDE.md`, sección 10); nunca se commitea ni se imprime. **No corras `npm run build` en local:** reescribe `public/sw.js`, que está versionado.

## Cómo verificar

```
npx tsc --noEmit -p .                  # 0 errores
npx eslint <archivos que tocaste>      # 0 errores (el repo entero todavía no está en cero)
```

Después de un push, a los 2–5 minutos: `curl -s https://alumno.jiujitsulatino.com/api/version` tiene que devolver los primeros 8 caracteres del sha del commit, y `curl -s https://alumno.jiujitsulatino.com/sw.js | grep CACHE_NAME` tiene que decir `jjl-<sha8>`. Si algo está roto: `git revert <sha> && git push`. No se pushea entre las 18:00 y las 23:00 de Argentina salvo hotfix: es cuando los alumnos usan la app.

## Migraciones

Están en `supabase/migrations/` (`AAAA_MM_DD_nombre.sql`, aditivas, comentadas en español). **Se escriben en el repo, pero las corre Sebastián a mano en el SQL editor de Supabase**; los agentes no corren migraciones. Que el archivo exista no garantiza que esté aplicada: varias no lo están (detalle en `CLAUDE.md`, sección 8), así que el código nuevo tiene que andar igual sin ellas. `supabase/schema.sql` es el esquema inicial, no la foto de producción.

## Crons

Vercel gratuito permite 2 crons, una vez por día cada uno, así que no se agregan crons a `vercel.json` (y no está confirmado cuáles de los declarados corren). El aviso al setter de "llenó el formulario y no agendó" corre cada hora desde cron-job.org contra `/api/cron/setter-no-book-followup`, y se queda ahí.

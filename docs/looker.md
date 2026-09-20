# Looker Studio leyendo directo de la base

Looker Studio tiene conector nativo de PostgreSQL. Con seis vistas en la base
(`v_*`) se conecta, lee, y deja de hacer falta la pestaña LOOKER del CRM, que se
llena a mano y por eso siempre está atrasada o incompleta.

Este documento dice qué tiene que hacer Sebastián una sola vez, qué vista va en
cada gráfico, y las trampas que hacen que un número dé mal sin que nadie lo note.

---

## 1. Puesta en marcha (una sola vez) — **[ACCIÓN DE SEBASTIÁN]**

### Paso 1. Correr las dos migraciones, SEGUIDAS

En Supabase → SQL Editor, pegar y correr en este orden, una atrás de la otra:

1. `supabase/migrations/2026_09_09_vistas_embudo_looker.sql`
2. `supabase/migrations/2026_09_20_vistas_ventas_setter.sql`

**Por qué seguidas y no "después veo la segunda":** en Supabase una vista recién
creada nace legible con la clave pública de la app (la `anon`, que viaja en el
navegador de cada visitante) y además se saltea RLS, porque corre con los
permisos de su dueño. El primer archivo crea `v_leads_recuperables` — nombre,
teléfono, email e Instagram de cada lead — y no le saca ese permiso. El segundo
archivo se lo saca a las seis. Entre uno y otro, esos datos quedan abiertos.

Si alguna falla por una columna que no existe, correr cada `CREATE VIEW` por
separado para ver cuál es. (Las columnas se verificaron contra producción el
19/9/2026, no debería pasar.)

### Paso 2. Verificar

```
node scripts/embudo-check.mjs
```

Tiene que terminar en "Todo en orden": las 6 vistas leídas, los controles
cruzados en OK y la sección EXPOSICIÓN con "permiso denegado" en las seis. Si
alguna dice **EXPUESTA**, no seguir: falta correr el segundo archivo.

### Paso 3. Crear el usuario de solo lectura

Looker NO tiene que entrar con el usuario `postgres`: ese puede borrar todo, y
la contraseña queda guardada en Google. Se crea uno que solo puede leer las seis
vistas. Ni siquiera puede leer las tablas de abajo.

Pegar en el SQL Editor **cambiando `<PASSWORD>`** por una contraseña larga, solo
letras y números (los símbolos rompen algunos conectores). La contraseña no va
al repo ni a ningún chat: va al gestor de contraseñas.

```sql
CREATE ROLE looker LOGIN PASSWORD '<PASSWORD>' NOINHERIT;

-- Solo las vistas. Sin permiso sobre ninguna tabla.
GRANT USAGE ON SCHEMA public TO looker;
GRANT SELECT ON
  public.v_embudo_diario,
  public.v_embudo_quiz_diario,
  public.v_leads_recuperables,
  public.v_agendas_registradas,
  public.v_ventas,
  public.v_embudo_mensual
TO looker;

-- Que una consulta mal armada en Looker no se quede colgada contra producción.
ALTER ROLE looker SET statement_timeout = '30s';
```

Para comprobar que quedó bien cerrado (opcional, en el mismo editor):

```sql
GRANT looker TO postgres;                   -- solo para poder probarlo desde acá
SET ROLE looker;
SELECT count(*) FROM public.v_ventas;       -- tiene que andar
SELECT count(*) FROM public.lead_sales;     -- tiene que dar "permission denied"
RESET ROLE;
```

Para cambiar la contraseña más adelante: `ALTER ROLE looker PASSWORD '<PASSWORD>';`
Para cortarle el acceso de un saque: `ALTER ROLE looker NOLOGIN;`

### Paso 4. Conectar Looker Studio

En Looker Studio → Crear → Fuente de datos → **PostgreSQL**.

| Campo | Qué poner |
|---|---|
| Host | El del **Session pooler**. Está en Supabase → botón **Connect** (arriba) → "Session pooler". Tiene la forma `aws-0-<región>.pooler.supabase.com`. Copiarlo de ahí, no armarlo a mano. |
| Puerto | `5432` |
| Base de datos | `postgres` |
| Usuario | `looker.<PROJECT_REF>` — el `<PROJECT_REF>` es lo que está antes de `.supabase.co` en `NEXT_PUBLIC_SUPABASE_URL`. Por el pooler el usuario SIEMPRE lleva ese sufijo. |
| Contraseña | La del paso 3. |
| SSL | Activarlo. Si pide certificado del servidor: Supabase → Project Settings → Database → SSL Configuration → Download certificate. |

**Por qué el pooler y no la conexión directa:** la directa
(`db.<PROJECT_REF>.supabase.co`) solo responde por IPv6, salvo que se pague el
add-on de IPv4, y Looker sale por IPv4: no conecta. El pooler sí responde por IPv4.

Si recién se creó el usuario y el pooler lo rechaza, esperar un par de minutos y
reintentar: tarda en enterarse de los usuarios nuevos.

Después se elige una vista por fuente de datos (son seis fuentes). **No usar
"consulta personalizada"**: la gracia es que la lógica viva en la vista, que está
versionada en el repo, y no repartida en gráficos de Looker que nadie revisa.

> No pude probar la conexión desde Looker (necesita la cuenta de Google y la
> contraseña). Los datos de la tabla salen de cómo funciona Supabase; si algo no
> coincide con lo que muestra el botón Connect, manda lo que diga Supabase.

---

## 2. Qué vista es cada gráfico

| Vista | Una fila es… | Dimensión de fecha | Para qué gráfico |
|---|---|---|---|
| `v_embudo_diario` | un día | `fecha` | El embudo del formulario: completaron → dispuestos a invertir → vieron calendario → eligieron horario → agendaron. Serie temporal y embudo. |
| `v_embudo_quiz_diario` | un día | `fecha` | El quiz "a qué luchador te parecés": dejaron contacto → terminaron → pasaron al formulario. |
| `v_leads_recuperables` | un lead que se cayó | `fecha` | Tabla de trabajo del setter, agrupada por `motivo`. Torta o barras por `motivo`. |
| `v_agendas_registradas` | un día (el de la consultoría) | `fecha` | Agendas que la app conoce, para contrastar con las de Calendly. |
| `v_ventas` | un cobro | **`fecha`** (o `mes`) | Tabla de ventas, ventas por setter, ventas por `origen_lead`, por `source`. |
| `v_embudo_mensual` | un mes | `mes` | El tablero de arriba de todo: leads → agendaron → ventas → plata, mes por mes. |

### Columnas de `v_ventas`

| Columna | Qué es |
|---|---|
| `fecha`, `mes` | La fecha **corregida** (ver trampa 2). Usar estas. |
| `fecha_venta` | El dato crudo de la tabla. No usarlo como dimensión. |
| `monto`, `moneda` | Siempre juntos (ver trampa 3). |
| `is_fee`, `tipo` | `tipo` es lo mismo que `is_fee` pero en palabras, para filtros. |
| `source` | `crm` = sync diario desde la pestaña LOOKER · `crm_ventas` = webhook del script del CRM de ventas · `manual` = cargada desde el panel. |
| `nombre` | Nombre de la cuenta; si no hay cuenta, el del CRM; si no, el del formulario. |
| `lead_id`, `origen_lead`, `lead_creado` | De qué lead salió la venta y cómo se lo encontró (abajo). |
| `setter`, `tiene_setter` | `users.nombre` del `assigned_to` de ese lead. `'Sin setter'` si no hay. |

`origen_lead` tiene cuatro valores, del más seguro al menos seguro:

1. **La venta se cargó sobre el lead** — tiene `lead_id` en la tabla.
2. **Lead marcado como convertido a este alumno** — alguien cargó `converted_user_id`.
3. **Lead con el mismo email que el alumno** — y creado antes de que termine el mes de la venta. Si el alumno llenó el formulario meses después de comprar, ese lead no originó la venta y no se cuenta.
4. **Sin lead** — no pasó por el formulario web (WhatsApp, recomendación, DM).

Un gráfico de ventas por `origen_lead` responde la pregunta que hoy nadie puede
contestar: **cuánta de la plata vino del embudo web y cuánta por afuera.**

### Tasas (campos calculados en Looker)

Las vistas traen cantidades, no porcentajes, a propósito: un porcentaje ya
calculado por día no se puede volver a promediar bien por semana o por mes.
Crear los campos calculados en Looker, siempre como suma sobre suma:

- Tasa de agenda: `SUM(agendaron) / SUM(completaron_form)`
- Del calendario a la agenda: `SUM(agendaron) / SUM(vieron_calendario)` (solo desde el 29/8, ver trampa 1)
- Tasa de cierre (en `v_embudo_mensual`): `SUM(leads_con_venta) / SUM(leads)`
- Ticket promedio en USD: `SUM(monto_usd) / SUM(ventas)` — solo tiene sentido mientras las ventas en ARS sean cero o estén corregidas (trampa 3)

---

## 3. Las trampas

### Trampa 1 — `vieron_calendario` y `eligieron_horario` existen desde el 29/8/2026

Antes de esa fecha la app no medía esos dos pasos. Las columnas dan 0, pero no es
que nadie vio el calendario: **es que no se anotaba.** Cualquier gráfico que las
use tiene que llevar el filtro `fecha >= 2026-08-29`. Si no, la "caída antes del
calendario" sale inflada y se termina arreglando algo que no está roto.

### Trampa 2 — las ventas del CRM no tienen día, tienen mes

El CRM no anota qué día se pagó. El sync las guarda como día 1 del mes a las
00:00 UTC. Pasado a hora argentina eso es el día anterior a las 21:00 — **el mes
anterior**. Las 21 ventas del CRM caerían todas en el mes equivocado. La vista lo
corrige en `fecha` y `mes`; por eso no hay que usar `fecha_venta`.

Consecuencia práctica: en un gráfico diario, las ventas del CRM aparecen todas
apiladas el día 1. No es un pico de ventas. Para ventas, mirar por mes.

(El panel de la app agrupa los meses en UTC. Puede diferir de Looker solo en una
venta cobrada el último día del mes entre las 21:00 y las 24:00 de Argentina.)

### Trampa 3 — hay dólares y pesos en la misma columna

Nunca sumar `monto` sin filtrar o desglosar por `moneda`. `v_embudo_mensual` ya
los trae separados (`monto_usd`, `monto_ars`, `monto_otra_moneda`); si
`monto_otra_moneda` da distinto de cero, hay una moneda nueva o vacía que mirar.

**Pendiente de datos:** al 19/9 las 7 filas con `source = 'crm_ventas'` dicen
`ARS` con montos de 300, 400, 571 y 600 (y fees de 50, 100 y 175). Tienen toda la
pinta de ser dólares mal etiquetados: nadie cobra 400 pesos. La vista muestra lo
que dice la tabla y no adivina. Mientras no se corrija, **septiembre da
`monto_usd = 0`**. Se arregla en el origen (el script externo que llama a
`/api/integrations/crm-ventas/mark-sold` manda `moneda: "ARS"`) y corrigiendo
esas 7 filas a mano. Está fuera del alcance de WP-04.

### Trampa 4 — en `v_embudo_mensual`, el embudo y la plata no son la misma gente

`leads`, `agendaron`, `convertidos` y `leads_con_venta` cuentan a los que
**llenaron el formulario ese mes** (cohorte). `ventas` y `monto_*` cuentan lo que
**se cobró ese mes** (caja). El que llenó el formulario en agosto y pagó en
septiembre suma en `leads_con_venta` de agosto y en `ventas` de septiembre.

La tasa de cierre de verdad es `leads_con_venta / leads`. `ventas / leads` del
mismo mes es una aproximación que sirve para ver la tendencia y nada más.

### Trampa 5 — `convertidos` casi no sirve

Cuenta los leads con `converted_user_id`, que se carga a mano y casi nadie
carga: 3 en toda la historia. Se deja porque es el número que ya muestra
`v_embudo_diario`. El que sirve es `leads_con_venta`, que sale de las ventas
reales.

### Trampa 6 — los fees no son ventas

Las reservas (`is_fee = true`) son devolutivas. Están en `v_ventas` para que se
vean, pero marcadas. Para hablar de ventas, filtrar `is_fee = false` (o
`tipo = Venta`). `v_embudo_mensual` ya las cuenta aparte, en `fees`.

### Trampa 7 — la mayoría de las ventas hoy sale "Sin setter"

No es un error de la vista. El setter sale del lead, y 11 de las 29 ventas no
tienen lead (no pasaron por el formulario) y otras 10 tienen un lead que nunca se
le asignó a nadie. Al 19/9 solo 8 ventas tienen setter. El número va a mejorar
solo a medida que las ventas se carguen sobre el lead, y sirve justamente para
ver cuánto falta.

La comisión del setter NO está en ninguna vista y no hay que agregarla: es una
decisión del dueño que no se muestre.

---

## 4. Números de control al 19/9/2026

Para saber si las vistas dan bien apenas se crean. Salen de simular la lógica de
las vistas contra las tablas, en solo lectura.

`v_ventas`: **29 filas** (21 `crm`, 7 `crm_ventas`, 1 `manual`). Por
`origen_lead`: 8 / 2 / 8 / 11. Con setter: 8.

`v_embudo_mensual`:

| mes | leads | agendaron | leads_con_venta | ventas | monto_usd | monto_ars | ventas_con_lead | ventas_con_setter | fees |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09 | 118 | 40 | 3 | 4 | 0 | 1871 | 4 | 3 | 3 |
| 2026-08 | 180 | 69 | 2 | 1 | 1200 | 0 | 1 | 1 | 0 |
| 2026-07 | 125 | 55 | 5 | 6 | 5400 | 0 | 5 | 1 | 0 |
| 2026-06 | 148 | 47 | 3 | 4 | 2380 | 0 | 3 | 0 | 0 |
| 2026-05 | 178 | 56 | 2 | 2 | 1800 | 0 | 2 | 0 | 0 |
| 2026-04 | 0 | 0 | 0 | 8 | 6900 | 0 | 0 | 0 | 0 |
| 2026-03 | 0 | 0 | 0 | 1 | 600 | 0 | 0 | 0 | 0 |

Septiembre va a seguir moviéndose; de agosto para atrás tiene que dar igual
(salvo que el sync del CRM traiga ventas viejas nuevas). Marzo y abril no tienen
leads porque la tabla de leads arranca en mayo.

---

## 5. Seguridad y mantenimiento

- **El aviso "Security Definer View" del panel de Supabase es esperado** para
  estas seis vistas. Es justamente lo que permite que el usuario `looker` lea
  las vistas sin tener permiso sobre las tablas. Lo que lo hace seguro es que
  `anon` y `authenticated` no tienen permiso sobre ellas (lo saca la sección 3 de
  la migración del 20/9 y lo controla `embudo-check.mjs`). **No "arreglarlo"
  pasándolas a `security_invoker`**: Looker dejaría de ver filas.
- **Toda vista nueva para Looker tiene que llevar su `REVOKE`.** Agregarla al
  bloque `DO` de la migración del 20/9 (copiado en una migración nueva), al
  `GRANT` del paso 3 y a la lista de `scripts/embudo-check.mjs`.
- `v_leads_recuperables` y `v_ventas` tienen datos personales. El informe de
  Looker se comparte con personas puntuales, nunca con "cualquiera que tenga el
  enlace".
- **Cambiar columnas de una vista:** `CREATE OR REPLACE VIEW` solo deja agregar
  columnas al final. Para renombrar o reordenar hay que borrar primero, en este
  orden porque la mensual lee de la de ventas:
  `DROP VIEW public.v_embudo_mensual; DROP VIEW public.v_ventas;` — y después
  volver a correr el `REVOKE` y el `GRANT ... TO looker`, que se pierden con el
  `DROP`. En Looker, "Actualizar campos" en la fuente de datos.
- Looker guarda los datos en caché. Si un número no coincide con
  `embudo-check.mjs`, antes de sospechar de la vista: en el informe, menú de los
  tres puntos → "Actualizar datos".
- `v_ventas` busca el lead de cada venta recorriendo los leads. Con decenas de
  ventas es instantáneo. Si algún día hay miles de ventas y se pone lenta, el
  arreglo es un índice sobre `lower(btrim(email))` en `lead_quiz_responses`.

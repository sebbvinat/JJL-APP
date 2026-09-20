-- Vistas de VENTAS y SETTER para Looker Studio.
--
-- La migracion 2026_09_09 dejo el embudo (formulario, quiz, recuperables,
-- agendas). Faltaba la punta que importa: la plata. Hasta hoy eso se miraba en
-- la pestaña LOOKER del CRM, que se llena a mano. Con estas dos vistas Looker
-- lee las ventas directo de `lead_sales`, con el setter al lado.
--
-- Son de solo lectura y no tocan ninguna tabla. Se corre DESPUES de
-- 2026_09_09_vistas_embudo_looker.sql y, de ser posible, EN LA MISMA SENTADA
-- (ver la seccion 3, "Permisos", para el porque).
--
-- Columnas verificadas contra produccion el 19/9/2026 con select de solo
-- lectura: todas las que se usan aca existen en lead_sales,
-- lead_quiz_responses y users.
--
-- Si algun dia hay que CAMBIAR columnas de estas vistas: CREATE OR REPLACE
-- VIEW solo deja agregar columnas AL FINAL. Para renombrar o reordenar hay que
-- hacer primero `DROP VIEW public.v_embudo_mensual; DROP VIEW public.v_ventas;`
-- (en ese orden, porque la mensual lee de v_ventas).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Las ventas, una fila por cobro, con alumno, lead de origen y setter.
--
-- Tres cosas que no son obvias y que si se hacen mal dan numeros falsos:
--
-- a) LA FECHA. Hay dos clases de `fecha_venta` mezcladas en la tabla:
--    - Las que trae el sync del CRM (source = 'crm') son "el mes de la venta":
--      el CRM no anota el dia del pago, asi que quedan como dia 1 a las 00:00
--      UTC (ej. 2026-04-01T00:00:00Z). Si eso se pasa a hora argentina da
--      31/3 a las 21:00 y la venta se va AL MES ANTERIOR. Las 21 ventas del
--      CRM caerian todas en el mes equivocado.
--    - Las demas (manual, crm_ventas) son el instante real del cobro, y esas
--      si hay que pasarlas a hora argentina, igual que el resto del embudo.
--    La regla: si la hora en UTC es exactamente 00:00:00, es una fecha de
--    calendario y se toma tal cual; si no, es un instante y va en hora de
--    Buenos Aires. No se mira `source` a proposito: una venta manual cargada
--    como "2026-07-10" a secas tiene el mismo problema y asi tambien queda bien.
--    En Looker usar `fecha` o `mes`, NO `fecha_venta`.
--
-- b) EL LEAD DE ORIGEN. Solo las ventas cargadas desde el panel o por el
--    webhook tienen `lead_id`. Las 21 del CRM entran con `user_id` y sin lead,
--    asi que con un join directo el setter saldria vacio en casi todo. Se
--    busca el lead en tres pasos, del mas seguro al menos seguro, y
--    `origen_lead` dice cual se uso para que nadie tenga que adivinar:
--      1. el lead sobre el que se cargo la venta;
--      2. el lead que alguien marco como convertido a este alumno;
--      3. un lead con el mismo email que la cuenta del alumno, creado antes
--         de que termine el mes de la venta (si el alumno lleno el formulario
--         meses despues de comprar, ese lead no origino la venta y darle el
--         credito a ese setter seria mentira).
--    Al 19/9 el paso 3 encuentra 9 de las 21 ventas del CRM, todas con el lead
--    creado el mismo mes de la venta y la cuenta creada despues: es gente que
--    entro por el formulario web y el CRM no lo sabia.
--    Siempre se elige UN solo lead (LIMIT 1): la vista tiene que dar
--    exactamente una fila por fila de `lead_sales`, si no los montos se
--    duplican en Looker sin que nadie se entere.
--
-- c) LA MONEDA. Hay USD y ARS en la misma columna `monto`. NUNCA sumar `monto`
--    sin filtrar o desglosar por `moneda`. (Ojo: al 19/9 las 7 filas de
--    source = 'crm_ventas' dicen ARS pero los montos son 300-600, que tienen
--    toda la pinta de ser dolares. La vista muestra lo que dice la tabla, no
--    adivina; hay que corregirlo en el origen. Ver docs/looker.md.)
--
-- Los fees (reservas) estan en la vista pero marcados: son devolutivos y no
-- son venta. En Looker, filtrar is_fee = false para hablar de ventas.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_ventas AS
SELECT
  s.id                                                        AS venta_id,
  f.fecha                                                     AS fecha,
  date_trunc('month', f.fecha::timestamp)::date               AS mes,
  s.fecha_venta                                               AS fecha_venta,
  s.monto                                                     AS monto,
  upper(btrim(s.moneda))                                      AS moneda,
  s.is_fee                                                    AS is_fee,
  CASE WHEN s.is_fee THEN 'Fee (reserva, no es venta)' ELSE 'Venta' END AS tipo,
  s.situacion                                                 AS situacion,
  s.concepto                                                  AS concepto,
  -- De donde salio la fila: 'crm' = sync diario de la pestaña LOOKER,
  -- 'crm_ventas' = webhook del script del CRM de ventas, 'manual' = cargada
  -- desde el panel.
  s.source                                                    AS source,
  -- El nombre de la cuenta manda; si no hay cuenta, el del CRM; si no, el
  -- que puso en el formulario.
  COALESCE(u.nombre, s.crm_nombre, l.nombre)                  AS nombre,
  s.crm_nombre                                                AS crm_nombre,
  COALESCE(s.user_id, l.converted_user_id)                    AS alumno_user_id,
  (COALESCE(s.user_id, l.converted_user_id) IS NOT NULL)      AS tiene_cuenta,
  l.id                                                        AS lead_id,
  CASE l.prioridad
    WHEN 1 THEN '1. La venta se cargo sobre el lead'
    WHEN 2 THEN '2. Lead marcado como convertido a este alumno'
    WHEN 3 THEN '3. Lead con el mismo email que el alumno'
    ELSE        '4. Sin lead (no paso por el formulario web)'
  END                                                         AS origen_lead,
  (l.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS lead_creado,
  -- 'Sin setter' en vez de NULL porque en Looker un NULL en un desglose se ve
  -- como "null" y confunde. Para contar, usar `tiene_setter`.
  COALESCE(st.nombre, 'Sin setter')                           AS setter,
  st.id                                                       AS setter_user_id,
  (st.id IS NOT NULL)                                         AS tiene_setter
FROM public.lead_sales s
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN (s.fecha_venta AT TIME ZONE 'UTC')::time = TIME '00:00:00'
      THEN (s.fecha_venta AT TIME ZONE 'UTC')::date
    ELSE (s.fecha_venta AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
  END AS fecha
) f
LEFT JOIN public.users u ON u.id = s.user_id
LEFT JOIN LATERAL (
  SELECT
    lq.id,
    lq.nombre,
    lq.assigned_to,
    lq.converted_user_id,
    lq.created_at,
    CASE
      WHEN lq.id = s.lead_id                THEN 1
      WHEN lq.converted_user_id = s.user_id THEN 2
      ELSE                                       3
    END AS prioridad
  FROM public.lead_quiz_responses lq
  WHERE lq.id = s.lead_id
     OR (s.lead_id IS NULL AND s.user_id IS NOT NULL AND lq.converted_user_id = s.user_id)
     OR (s.lead_id IS NULL
         AND u.email IS NOT NULL
         AND lower(btrim(lq.email)) = lower(btrim(u.email))
         AND lq.created_at < ((date_trunc('month', f.fecha::timestamp) + interval '1 month')
                              AT TIME ZONE 'America/Argentina/Buenos_Aires'))
  -- Primero el match mas seguro; a igual seguridad, el lead mas reciente.
  ORDER BY prioridad, lq.created_at DESC
  LIMIT 1
) l ON true
LEFT JOIN public.users st ON st.id = l.assigned_to
ORDER BY f.fecha DESC, s.created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. El embudo completo, mes por mes: de lead a plata.
--
-- OJO al leerla: las columnas del embudo y las de ventas NO son la misma
-- gente. `leads`, `agendaron`, `convertidos` y `leads_con_venta` cuentan a los
-- que LLENARON EL FORMULARIO ese mes (cohorte). `ventas` y `monto_*` cuentan lo
-- que SE COBRO ese mes (caja). Uno que lleno el formulario en agosto y pago en
-- septiembre suma en `leads_con_venta` de agosto y en `ventas` de septiembre.
-- Dividir `ventas / leads` del mismo mes es una aproximacion; la tasa de
-- cierre de verdad es `leads_con_venta / leads`.
--
-- `convertidos` se deja porque es el numero que ya muestra v_embudo_diario,
-- pero casi nadie marca `converted_user_id` a mano (3 en toda la historia al
-- 19/9). `leads_con_venta` sale de las ventas reales y es el que sirve.
--
-- Los montos van separados por moneda para que no se pueda sumar pesos con
-- dolares por accidente. `monto_otra_moneda` existe para que una moneda nueva
-- o vacia no desaparezca en silencio: si da distinto de 0, hay algo que mirar.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_embudo_mensual AS
WITH ventas AS (
  -- Se lee de v_ventas y no de lead_sales para no escribir dos veces la regla
  -- de la fecha ni la del lead de origen: si hubiera dos copias, tarde o
  -- temprano una se corrige y la otra no, y los dos tableros dejan de coincidir.
  -- Columnas nombradas (no `*`) para depender solo de las que se usan.
  SELECT mes, monto, moneda, is_fee, lead_id, alumno_user_id, tiene_setter
  FROM public.v_ventas
),
leads_que_compraron AS (
  SELECT DISTINCT lead_id
  FROM ventas
  WHERE lead_id IS NOT NULL AND NOT is_fee
),
embudo AS (
  SELECT
    date_trunc('month', lq.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS mes,
    count(*)                                                AS leads,
    count(*) FILTER (WHERE lq.urgencia = 'si')              AS dispuestos_a_invertir,
    count(*) FILTER (WHERE lq.booked)                       AS agendaron,
    count(*) FILTER (WHERE lq.converted_user_id IS NOT NULL) AS convertidos,
    count(c.lead_id)                                        AS leads_con_venta
  FROM public.lead_quiz_responses lq
  LEFT JOIN leads_que_compraron c ON c.lead_id = lq.id
  GROUP BY 1
),
caja AS (
  SELECT
    mes,
    count(*) FILTER (WHERE NOT is_fee)                                          AS ventas,
    count(DISTINCT COALESCE(alumno_user_id, lead_id)) FILTER (WHERE NOT is_fee) AS compradores,
    COALESCE(sum(monto) FILTER (WHERE NOT is_fee AND moneda = 'USD'), 0)        AS monto_usd,
    COALESCE(sum(monto) FILTER (WHERE NOT is_fee AND moneda = 'ARS'), 0)        AS monto_ars,
    COALESCE(sum(monto) FILTER (WHERE NOT is_fee
                                  AND (moneda IS NULL OR moneda NOT IN ('USD', 'ARS'))), 0) AS monto_otra_moneda,
    count(*) FILTER (WHERE NOT is_fee AND lead_id IS NOT NULL)                  AS ventas_con_lead,
    count(*) FILTER (WHERE NOT is_fee AND tiene_setter)                         AS ventas_con_setter,
    count(*) FILTER (WHERE is_fee)                                              AS fees
  FROM ventas
  GROUP BY 1
)
SELECT
  COALESCE(e.mes, c.mes)                     AS mes,
  to_char(COALESCE(e.mes, c.mes), 'YYYY-MM') AS mes_texto,
  COALESCE(e.leads, 0)                       AS leads,
  COALESCE(e.dispuestos_a_invertir, 0)       AS dispuestos_a_invertir,
  COALESCE(e.agendaron, 0)                   AS agendaron,
  COALESCE(e.convertidos, 0)                 AS convertidos,
  COALESCE(e.leads_con_venta, 0)             AS leads_con_venta,
  COALESCE(c.ventas, 0)                      AS ventas,
  COALESCE(c.compradores, 0)                 AS compradores,
  COALESCE(c.monto_usd, 0)                   AS monto_usd,
  COALESCE(c.monto_ars, 0)                   AS monto_ars,
  COALESCE(c.monto_otra_moneda, 0)           AS monto_otra_moneda,
  COALESCE(c.ventas_con_lead, 0)             AS ventas_con_lead,
  COALESCE(c.ventas_con_setter, 0)           AS ventas_con_setter,
  COALESCE(c.fees, 0)                        AS fees
FROM embudo e
FULL OUTER JOIN caja c ON c.mes = e.mes
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Permisos: que la clave publica NO pueda leer estas vistas.
--
-- El comentario final de la migracion del 9/9 dice que "las vistas heredan RLS
-- de las tablas de abajo". En Postgres eso NO es asi por defecto: una vista
-- corre con los permisos de su dueño (postgres), que es dueño de las tablas y
-- por eso se saltea RLS. Y en Supabase todo lo que se crea en `public` nace con
-- permiso de lectura para `anon` y `authenticated` (se verifico el 19/9: la
-- clave anon recibe 200 sobre lead_sales, o sea tiene el GRANT; lo unico que
-- la frena es RLS).
--
-- Las dos cosas juntas: apenas se crean, cualquiera con la clave publica de la
-- app (que viaja en el navegador de cada visitante) puede pedir
-- /rest/v1/v_leads_recuperables y llevarse nombre, telefono, email e Instagram
-- de todos los leads, y /rest/v1/v_ventas con nombres y montos.
--
-- Se arregla sacandoles el permiso a `anon` y `authenticated`. No se usa
-- `security_invoker = true` a proposito: con eso el usuario de Looker
-- necesitaria permiso sobre las TABLAS crudas; asi, en cambio, Looker solo
-- puede leer lo que las vistas muestran y nada mas. El panel de Supabase las
-- va a marcar como "Security Definer View": es esperado, y con el REVOKE de
-- aca abajo no hay exposicion.
--
-- El bloque cubre tambien las 4 vistas del 9/9 (si existen), porque ese
-- archivo no las protege. Por eso conviene correr los dos archivos seguidos:
-- entre uno y otro, las 4 primeras quedan abiertas.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  vista text;
BEGIN
  FOREACH vista IN ARRAY ARRAY[
    'v_embudo_diario',
    'v_embudo_quiz_diario',
    'v_leads_recuperables',
    'v_agendas_registradas',
    'v_ventas',
    'v_embudo_mensual'
  ]
  LOOP
    IF to_regclass('public.' || vista) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', vista);
      -- El service_role es el que usa scripts/embudo-check.mjs.
      EXECUTE format('GRANT SELECT ON public.%I TO service_role', vista);
    END IF;
  END LOOP;
END
$$;

-- Que la API se entere de las vistas nuevas sin esperar (Supabase suele
-- hacerlo solo; esto lo asegura y no molesta si ya lo hizo).
NOTIFY pgrst, 'reload schema';

-- El usuario de solo lectura para Looker NO se crea aca: lleva contraseña y
-- las contraseñas no van al repo. El SQL esta en docs/looker.md.

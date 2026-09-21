-- Que cuenta como VENTA (definicion de Sebastian, 21/9/2026):
--
--   "Ventas es solo si pagan la 1ra cuota, es decir 300 o mas."
--
-- Hasta ahora las vistas contaban como venta cualquier cobro que no fuera fee.
-- Eso mezclaba dos cosas: la venta (alguien entra al programa) y la caja (lo
-- que se cobra). Una 2da cuota es plata que entra, pero NO es una venta nueva:
-- en septiembre la vista decia 4 ventas y eran 3 ventas mas una 2da cuota.
--
-- Se agrega `es_venta` a v_ventas, que es verdadero cuando:
--   - no es fee (reserva, fee devolutivo), Y
--   - el monto es 300 o mas, Y
--   - el concepto no dice 2da, 3ra, ... cuota.
-- Las ventas del sync del CRM y las manuales no traen concepto: cuentan como
-- venta si llegan a 300 (el sync ya filtraba por 300).
--
-- En v_embudo_mensual, `ventas`, `compradores`, `ventas_con_lead`,
-- `ventas_con_setter` y `leads_con_venta` pasan a contar solo es_venta. Los
-- MONTOS no cambian: siguen siendo toda la caja que no es fee, cuotas
-- incluidas. La columna nueva `cuotas_posteriores` dice cuantos de esos cobros
-- no fueron una venta nueva.
--
-- No toca datos. Las columnas nuevas van al final (CREATE OR REPLACE VIEW no
-- deja otra cosa) y los permisos de las vistas se conservan.

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
  (st.id IS NOT NULL)                                         AS tiene_setter,
  -- Va AL FINAL porque CREATE OR REPLACE VIEW solo deja agregar columnas ahi.
  (NOT s.is_fee
   AND s.monto >= 300
   AND COALESCE(s.concepto, '') !~* '^ *([2-9]|segunda|tercera|cuarta|quinta|sexta)')
                                                              AS es_venta
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

CREATE OR REPLACE VIEW public.v_embudo_mensual AS
WITH ventas AS (
  -- Se lee de v_ventas y no de lead_sales para no escribir dos veces la regla
  -- de la fecha ni la del lead de origen: si hubiera dos copias, tarde o
  -- temprano una se corrige y la otra no, y los dos tableros dejan de coincidir.
  -- Columnas nombradas (no `*`) para depender solo de las que se usan.
  SELECT mes, monto, moneda, is_fee, lead_id, alumno_user_id, tiene_setter, es_venta
  FROM public.v_ventas
),
leads_que_compraron AS (
  SELECT DISTINCT lead_id
  FROM ventas
  WHERE lead_id IS NOT NULL AND es_venta
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
    count(*) FILTER (WHERE es_venta)                                            AS ventas,
    count(DISTINCT COALESCE(alumno_user_id, lead_id)) FILTER (WHERE es_venta)   AS compradores,
    COALESCE(sum(monto) FILTER (WHERE NOT is_fee AND moneda = 'USD'), 0)        AS monto_usd,
    COALESCE(sum(monto) FILTER (WHERE NOT is_fee AND moneda = 'ARS'), 0)        AS monto_ars,
    COALESCE(sum(monto) FILTER (WHERE NOT is_fee
                                  AND (moneda IS NULL OR moneda NOT IN ('USD', 'ARS'))), 0) AS monto_otra_moneda,
    count(*) FILTER (WHERE es_venta AND lead_id IS NOT NULL)                    AS ventas_con_lead,
    count(*) FILTER (WHERE es_venta AND tiene_setter)                           AS ventas_con_setter,
    count(*) FILTER (WHERE is_fee)                                              AS fees,
    count(*) FILTER (WHERE NOT is_fee AND NOT es_venta)                         AS cuotas_posteriores
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
  COALESCE(c.fees, 0)                        AS fees,
  COALESCE(c.cuotas_posteriores, 0)          AS cuotas_posteriores
FROM embudo e
FULL OUTER JOIN caja c ON c.mes = e.mes
ORDER BY 1 DESC;

NOTIFY pgrst, 'reload schema';

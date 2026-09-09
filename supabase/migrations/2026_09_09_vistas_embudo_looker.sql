-- Vistas del embudo para conectar Looker Studio directo a Postgres.
--
-- Looker Studio tiene conector nativo de PostgreSQL. Con estas vistas no hace
-- falta exportar nada a mano: se conecta a la base y lee.
--
-- Son de solo lectura y no tocan ninguna tabla.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. El embudo dia por dia.
--
-- Ojo con dos columnas: `vieron_calendario` y `eligieron_horario` existen
-- desde el 29/8/2026. Cualquier cuenta de "no vio el calendario" que incluya
-- fechas anteriores esta inflada: no es que no lo vieron, es que no se medía.
-- En Looker conviene filtrar fecha >= 2026-08-29 en cualquier grafico que
-- las use.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_embudo_diario AS
SELECT
  (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha,
  count(*)                                                    AS completaron_form,
  -- OJO: el filtro del formulario NO es `disqualified`. Ninguna opcion lo
  -- marca; es una bandera que pone el setter a mano (12 filas en toda la
  -- historia). Lo que decide si ve el calendario es `urgencia`: el que
  -- contesta "no" a si esta dispuesto a invertir no lo ve, pero NO queda
  -- descalificado a proposito -- el setter lo trabaja por DM con low ticket.
  count(*) FILTER (WHERE urgencia = 'si')                     AS dispuestos_a_invertir,
  count(*) FILTER (WHERE urgencia = 'no')                     AS no_invierte,
  count(*) FILTER (WHERE disqualified)                        AS descartados_a_mano,
  count(*) FILTER (WHERE calendly_loaded_at IS NOT NULL)      AS vieron_calendario,
  count(*) FILTER (WHERE calendly_datetime_selected_at IS NOT NULL) AS eligieron_horario,
  count(*) FILTER (WHERE booked)                              AS agendaron,
  count(*) FILTER (WHERE converted_user_id IS NOT NULL)       AS convertidos,
  -- Con que datos quedamos para poder seguirlos
  count(*) FILTER (WHERE instagram IS NOT NULL)               AS con_instagram,
  count(*) FILTER (WHERE telefono IS NOT NULL)                AS con_telefono,
  count(*) FILTER (WHERE email IS NOT NULL)                   AS con_email
FROM public.lead_quiz_responses
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. El embudo del quiz "A que luchador te pareces", dia por dia.
--
-- Es el paso previo: el quiz no filtra, solo entretiene y junta el contacto.
-- Lo unico que dice si sirve es `pasaron_al_form`.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_embudo_quiz_diario AS
SELECT
  (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha,
  count(*)                                                AS dejaron_contacto,
  count(*) FILTER (WHERE match_arquetipo IS NOT NULL)     AS terminaron_quiz,
  count(*) FILTER (WHERE match_arquetipo IS NULL)         AS abandonaron,
  count(*) FILTER (WHERE clicked_form)                    AS pasaron_al_form,
  -- Historico: el boton de WhatsApp en la ficha existio del 8 al 9/9/2026.
  -- Se saco porque salteaba el filtro del formulario. La columna queda para
  -- no perder esas filas, pero de aca en mas siempre va a dar 0.
  count(*) FILTER (WHERE clicked_dm)                      AS escribieron_whatsapp_historico,
  count(*) FILTER (WHERE shared_to_ig)                    AS compartieron,
  count(*) FILTER (WHERE whatsapp IS NOT NULL)            AS con_telefono
FROM public.match_quiz_responses
GROUP BY 1
ORDER BY 1 DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Los recuperables: quien se cayo, donde, y con que lo contactamos.
--
-- Ordenados de mas caliente a mas frio. `motivo` es literalmente la cola de
-- trabajo del setter: el que eligio dia y hora y no confirmo es otra
-- conversacion que el que ni vio el calendario.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_leads_recuperables AS
SELECT
  l.session_id,
  l.created_at,
  (l.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha,
  l.nombre,
  l.instagram,
  l.telefono,
  l.email,
  l.stage,
  l.last_contact_at,
  CASE
    WHEN l.calendly_datetime_selected_at IS NOT NULL THEN '1. Eligio dia y hora y no confirmo'
    WHEN l.calendly_loaded_at IS NOT NULL            THEN '2. Vio el calendario y no eligio'
    WHEN l.urgencia = 'no'                           THEN '3. Dijo que no invierte (va por DM, low ticket)'
    WHEN l.urgencia = 'si'                           THEN '4. Dijo que si invierte y no llego al calendario'
    ELSE                                                  '5. No termino el formulario'
  END AS motivo,
  -- Cuantos dias hace que se cayo, para priorizar
  (now()::date - (l.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS dias
FROM public.lead_quiz_responses l
WHERE NOT l.booked
  AND l.converted_user_id IS NULL
  AND (l.instagram IS NOT NULL OR l.telefono IS NOT NULL OR l.email IS NOT NULL)
ORDER BY motivo, l.created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. El agujero de atribucion, en una sola fila por dia.
--
-- Calendly tiene mas agendas que las que la app registra, y no es un bug:
-- del 29/8 al 9/9 hubo 47 eventos y 26 vinieron del formulario web. Los otros
-- 21 los cargo el propio equipo desde Calendly (`invitee_scheduled_by` = JJL,
-- sin respuestas del formulario y sin utm), o sea cierres por WhatsApp o DM.
--
-- Es un canal real, no una fuga. Pero mientras no quede registrado, el
-- rendimiento del embudo web se ve peor de lo que es y no se puede comparar
-- un canal contra el otro. Esta vista deja el numero de la app a mano para
-- contrastarlo con el de Calendly, que hay que traer por API.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_agendas_registradas AS
SELECT
  (COALESCE(scheduled_at, created_at) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha,
  count(*) FILTER (WHERE booked)                                AS agendas_en_la_app,
  count(*) FILTER (WHERE booked AND calendly_event_uri IS NOT NULL) AS con_evento_de_calendly,
  count(*) FILTER (WHERE booked AND telefono IS NOT NULL)       AS con_telefono
FROM public.lead_quiz_responses
GROUP BY 1
ORDER BY 1 DESC;

-- Las vistas heredan RLS de las tablas de abajo; solo el service_role y los
-- roles con permiso explicito las leen. Para Looker conviene crear un usuario
-- de solo lectura en vez de usar el de siempre.

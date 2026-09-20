-- Limite de frecuencia para los endpoints publicos del embudo (WP-03).
--
-- POR QUE EXISTE
-- /api/leads/* y /api/track-click los puede llamar cualquiera desde afuera, sin
-- login. Hasta ahora nada impedia que un script mandara mil POST seguidos: cada
-- uno le dispara un WhatsApp al coach, un webhook a Make y una fila en la base.
-- Vercel es serverless (cada pedido puede caer en un proceso distinto), asi que
-- un contador en memoria no sirve: el contador tiene que vivir en la base.
--
-- QUE HACE ESTA MIGRACION
-- Crea UNA tabla chica y UNA funcion. No toca ni lee ningun dato existente.
-- Es segura de correr mas de una vez (IF NOT EXISTS / CREATE OR REPLACE).
--
-- QUE PASA SI NO SE CORRE
-- Nada se rompe: src/lib/rate-limit.ts falla ABIERTO. Si la funcion no existe,
-- deja pasar todo y escribe un warn `rate-limit.sin-tabla` en los logs. El
-- limite empieza a hacer efecto recien cuando esta migracion este corrida.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  -- Ej: "quiz:3f9a1c0b7d2e4a61" (ruta + hash de la IP) o "phone-wa:<session_id>".
  -- Nunca guardamos la IP en crudo: es un dato personal y aca no hace falta.
  clave          text PRIMARY KEY,
  -- Cuando arranco la ventana actual. Pasados `ventana_seg` segundos, el
  -- proximo pedido la reinicia y el contador vuelve a 1.
  ventana_inicio timestamptz NOT NULL DEFAULT now(),
  cuenta         integer     NOT NULL DEFAULT 0
);

-- Para la limpieza de filas viejas (ver mas abajo) sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS api_rate_limits_ventana_idx
  ON public.api_rate_limits (ventana_inicio);

-- RLS prendido y SIN politicas: ni `anon` ni `authenticated` pueden leer o
-- escribir. Solo entra el service role (que saltea RLS), que es el que usa la
-- API del lado servidor.
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Suma 1 al contador de `p_clave` y devuelve TRUE si el pedido entra dentro del
-- limite, FALSE si ya se paso.
--
-- Los parametros llevan prefijo `p_` a proposito: si se llamaran igual que las
-- columnas (`clave`), Postgres no sabe a cual te referis dentro del ON CONFLICT
-- y la funcion falla con "column reference is ambiguous".
--
-- Es atomica: el INSERT ... ON CONFLICT DO UPDATE bloquea la fila, asi que dos
-- pedidos simultaneos de la misma IP no pueden leer el mismo valor y "colarse"
-- los dos. Por eso es una funcion y no un select + update desde Node.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_clave       text,
  p_limite      integer,
  p_ventana_seg integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
-- search_path fijo: en una funcion SECURITY DEFINER evita que alguien cuele una
-- tabla con el mismo nombre en otro esquema y la funcion escriba ahi.
SET search_path = public
AS $$
DECLARE
  v_cuenta integer;
  v_corte  timestamptz;
BEGIN
  -- Argumentos sin sentido: dejamos pasar. El limite es una proteccion, no puede
  -- ser el motivo por el que se pierde un lead.
  IF p_clave IS NULL OR p_clave = '' OR p_limite IS NULL OR p_ventana_seg IS NULL
     OR p_ventana_seg <= 0 THEN
    RETURN true;
  END IF;

  v_corte := now() - make_interval(secs => p_ventana_seg);

  INSERT INTO public.api_rate_limits AS r (clave, ventana_inicio, cuenta)
  VALUES (left(p_clave, 200), now(), 1)
  ON CONFLICT (clave) DO UPDATE
    SET cuenta         = CASE WHEN r.ventana_inicio < v_corte THEN 1     ELSE r.cuenta + 1     END,
        ventana_inicio = CASE WHEN r.ventana_inicio < v_corte THEN now() ELSE r.ventana_inicio END
  RETURNING r.cuenta INTO v_cuenta;

  -- Limpieza oportunista: mas o menos 1 de cada 100 llamadas borra las filas que
  -- llevan mas de 2 dias sin uso (la ventana mas larga que usamos es de 24 h).
  -- Se hace aca adentro porque Vercel esta en plan gratuito (2 crons) y no vale
  -- la pena gastar uno en esto.
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits
    WHERE ventana_inicio < now() - interval '2 days';
  END IF;

  RETURN v_cuenta <= p_limite;
END;
$$;

-- Supabase le da EXECUTE a todos los roles por default. Se lo sacamos: si no,
-- cualquiera con la anon key podria llamar la funcion por /rest/v1/rpc y
-- llenar la tabla o gastarle el cupo a otra IP.
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

COMMENT ON TABLE public.api_rate_limits IS
  'Contadores del limite de frecuencia de los endpoints publicos. Se borra sola; se puede vaciar sin riesgo (truncate) si hiciera falta destrabar a alguien.';
COMMENT ON FUNCTION public.rate_limit_hit(text, integer, integer) IS
  'Suma 1 al contador de la clave y devuelve true si sigue dentro del limite. La usa src/lib/rate-limit.ts.';

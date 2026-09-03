-- El cinturón lo declara el alumno, no la app.
--
-- Hasta ahora se calculaba solo por progreso en el programa (semana 4 → azul,
-- 8 → púrpura, 16 → marrón, 24 → negro) y ese valor PISABA lo que el alumno
-- o el admin hubieran puesto. Resultado: gente con cinturón que no es el suyo
-- — hoy hay 10 azules, 1 púrpura y 3 negros que en su mayoría salieron de ahí,
-- no de la realidad.
--
-- El cinturón es un grado que se da en el tatami, no algo que se gane
-- completando videos. Así que pasa a ser autodeclarado.
--
-- `cinturon_confirmado_at` marca que la persona YA lo eligió. Sirve para
-- mostrarle el cartel una sola vez: sin esta columna no se puede distinguir
-- "es cinturón blanco" de "nunca lo eligió", porque blanco es el default.
--
-- Idempotente.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cinturon_confirmado_at timestamptz;

COMMENT ON COLUMN public.users.cinturon_confirmado_at IS
  'Cuándo el alumno confirmó su propio cinturón. NULL = todavía no lo eligió, se le muestra el cartel al abrir la app.';

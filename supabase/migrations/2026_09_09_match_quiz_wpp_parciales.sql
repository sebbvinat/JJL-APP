-- Dos cambios sobre el quiz "A que luchador te pareces".
--
-- 1. `whatsapp`. Reemplaza a `ocupacion` en el formulario: el numero sirve
--    para contactar, la ocupacion solo para calificar. `ocupacion` queda en la
--    tabla (no tiene datos y borrar una columna no se deshace).
--
-- 2. `match_arquetipo` y `match_pct` pasan a aceptar NULL. Hasta ahora la fila
--    se creaba recien al terminar el quiz, asi que el que abandonaba a mitad
--    no dejaba NADA y no habia forma de contactarlo. Ahora la fila se crea
--    apenas carga el contacto, y el arquetipo se completa si llega al final.
--    Fila con arquetipo NULL = se quedo en el medio.

ALTER TABLE public.match_quiz_responses
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ALTER COLUMN match_arquetipo DROP NOT NULL,
  ALTER COLUMN match_pct DROP NOT NULL;

-- El panel lista por fecha y separa completos de abandonados.
CREATE INDEX IF NOT EXISTS match_quiz_incompletos_idx
  ON public.match_quiz_responses (created_at DESC)
  WHERE match_arquetipo IS NULL;

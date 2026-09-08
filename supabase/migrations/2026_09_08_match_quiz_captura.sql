-- Captura de identidad en el quiz "¿A qué luchador te parecés?".
--
-- La tabla ya tenia `nombre` e `instagram` desde el dia uno, pero la ficha de
-- resultado nunca los pedia: 6 respuestas guardadas, 0 identidades. El que
-- apretaba WhatsApp y no mandaba el mensaje se perdia entero.
--
-- `ocupacion` es la unica columna nueva de verdad. Es el segundo criterio de
-- calificacion (nicho / inversion) y ahora lo tenemos antes de la llamada,
-- sin gastar la pregunta en la call.

ALTER TABLE public.match_quiz_responses
  ADD COLUMN IF NOT EXISTS ocupacion text,
  -- Estas dos ya existen en produccion (se agregaron a mano cuando se sumaron
  -- las preguntas). Van con IF NOT EXISTS para que un entorno limpio quede igual.
  ADD COLUMN IF NOT EXISTS frecuencia text,
  ADD COLUMN IF NOT EXISTS antiguedad text;

-- Los unicos accionables son los que dejaron contacto.
CREATE INDEX IF NOT EXISTS match_quiz_instagram_idx
  ON public.match_quiz_responses (instagram)
  WHERE instagram IS NOT NULL;

-- Tabla del quiz viral "¿A qué luchador te parecés?".
-- Vive paralela a `lead_quiz_responses` (que es el quiz de consultoría).
--
-- Cada fila = un quiz completado. La identidad la traemos por:
--   - session_id (UUID generado en el browser, anónimo)
--   - instagram (opcional, lo pide el quiz al final)
--   - email (opcional)
--
-- Solo escribe/lee el service_role.

CREATE TABLE IF NOT EXISTS public.match_quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  -- respuestas del quiz
  peso text,
  fisico text,
  estilo text,
  posicion text,
  finalizacion text,
  dolor text,
  vision text,
  -- contacto opcional
  nombre text,
  instagram text,
  -- resultado calculado
  match_arquetipo text NOT NULL,   -- 'gordon' | 'buchecha' | 'bernardo' | 'marcelo' | 'cobrinha'
  match_pct integer NOT NULL,      -- 75-95
  -- tracking
  shared_to_ig boolean DEFAULT false,  -- click en "compartir"
  clicked_dm boolean DEFAULT false,    -- click en "abrir DM"
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS match_quiz_created_at_idx
  ON public.match_quiz_responses (created_at DESC);
CREATE INDEX IF NOT EXISTS match_quiz_arquetipo_idx
  ON public.match_quiz_responses (match_arquetipo);

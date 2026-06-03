-- Lead sales: cada venta/cuota cobrada de un lead se registra como una fila.
-- Lo dispara el webhook /api/integrations/crm-ventas/mark-sold cuando el
-- script externo actualizar_venta.js registra movimiento.
--
-- Cuotas: un mismo lead puede tener varias filas (una por cuota cobrada).
-- Fees / reservas: se marcan is_fee=true y NO suman para la comisión del
-- setter (regla del coach — los fees son devolutivos y no son venta real).

CREATE TABLE IF NOT EXISTS public.lead_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES public.lead_quiz_responses(id) ON DELETE CASCADE,
  monto        NUMERIC(12, 2),
  moneda       TEXT,
  situacion    TEXT,            -- "Adentro en Llamada" | "Adentro en Seguimiento" | "Fee" | etc.
  concepto     TEXT,            -- nota libre que llega del CRM (ej. "Cuota 1/3", "Fee primera consulta")
  is_fee       BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_venta  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       TEXT NOT NULL DEFAULT 'crm_ventas',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_sales_lead       ON public.lead_sales (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_sales_fecha      ON public.lead_sales (fecha_venta DESC);

-- Service-role escribe via supabase admin client; lectura admin-only via API.
ALTER TABLE public.lead_sales ENABLE ROW LEVEL SECURITY;

-- Setter onboarding: marca el primer acceso del usuario taggeado 'setter'
-- a /admin/agendas para que la guía se muestre una sola vez.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS setter_guide_seen_at TIMESTAMPTZ;

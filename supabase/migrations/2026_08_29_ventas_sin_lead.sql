-- Una venta tiene que poder existir sin un lead.
--
-- Hoy `lead_sales.lead_id` es NOT NULL, y eso deja plata afuera del sistema:
-- los leads solo existen si la persona hizo el quiz. Francisco Muchut pagó
-- $900 el 10/07 y no se le puede cargar la venta porque nunca fue lead —
-- entró por WhatsApp. Lo mismo para todo lo que venga por recomendación o
-- por el low ticket.
--
-- Cambios:
--   - lead_id pasa a ser opcional.
--   - user_id: a qué alumno corresponde la venta. Es la referencia que sí
--     existe siempre una vez que la persona tiene cuenta.
--   - crm_nombre: el nombre tal cual figura en la pestaña LOOKER del CRM,
--     que es de donde se van a sincronizar las ventas. Sirve de clave para
--     que el sync pueda correr todos los días sin duplicar.
--
-- Al menos una de las dos referencias tiene que estar: una venta sin lead ni
-- alumno no se le puede atribuir a nadie.
--
-- Idempotente.
ALTER TABLE public.lead_sales ALTER COLUMN lead_id DROP NOT NULL;

ALTER TABLE public.lead_sales
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.lead_sales
  ADD COLUMN IF NOT EXISTS crm_nombre text;

-- Evita duplicar al re-sincronizar el CRM: misma persona, misma fecha, mismo
-- monto = la misma venta. Solo aplica a las que vienen del CRM.
CREATE UNIQUE INDEX IF NOT EXISTS lead_sales_crm_unico
  ON public.lead_sales (crm_nombre, fecha_venta, monto)
  WHERE crm_nombre IS NOT NULL;

-- Una venta suelta, sin lead ni alumno, no se le puede atribuir a nadie.
ALTER TABLE public.lead_sales DROP CONSTRAINT IF EXISTS lead_sales_tiene_dueno;
ALTER TABLE public.lead_sales
  ADD CONSTRAINT lead_sales_tiene_dueno
  CHECK (lead_id IS NOT NULL OR user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS lead_sales_user_id_idx ON public.lead_sales (user_id);

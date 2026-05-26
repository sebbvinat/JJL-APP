-- ============================================================
-- CRM Foundation — Phase 0
-- ============================================================
-- Soporta las features A (perfil CRM), B (home dashboard),
-- C (setter pipeline) y D (coaching workflow) del plan.
-- Idempotente (re-run safe).
-- ============================================================

-- 1) lifecycle_stage ENUM (Postgres no soporta CREATE TYPE IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE lifecycle_stage AS ENUM (
    'prospect',    -- todavía no es alumno
    'onboarding',  -- recién entró, primer mes
    'active',      -- en curso
    'at_risk',     -- inactivo / alertas
    'paused',      -- pausa formal acordada
    'churned'      -- se fue
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Columnas nuevas en users (CRM + coaching)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lifecycle_stage lifecycle_stage NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS lifecycle_changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eligible_1on1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS month_completed_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- Backfill: program_member existentes pasan a 'active', con started_at = onboarding_completed_at o created_at.
UPDATE public.users
   SET lifecycle_stage = 'active',
       lifecycle_changed_at = NOW(),
       started_at = COALESCE(onboarding_completed_at, created_at)
 WHERE program_member = TRUE
   AND rol != 'admin'
   AND lifecycle_stage = 'prospect';

CREATE INDEX IF NOT EXISTS idx_users_lifecycle ON public.users(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_users_eligible_1on1
  ON public.users(eligible_1on1_at) WHERE eligible_1on1_at IS NOT NULL;

-- 3) admin_notes — notas privadas del admin por alumno
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  texto TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_notes_user
  ON public.admin_notes(user_id, created_at DESC);
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages notes" ON public.admin_notes;
CREATE POLICY "Admin manages notes" ON public.admin_notes
  FOR ALL USING (public.is_admin());

-- 4) llamadas — log de 1-on-1 / setter / etc
CREATE TABLE IF NOT EXISTS public.llamadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('1on1', 'onboarding', 'setter', 'reactivacion', 'otro')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_min INTEGER,
  status TEXT NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada', 'completada', 'no_show', 'cancelada')),
  notes TEXT,
  meet_link TEXT,
  event_id UUID REFERENCES public.events ON DELETE SET NULL,
  called_by UUID REFERENCES public.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llamadas_user
  ON public.llamadas(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_llamadas_status_scheduled
  ON public.llamadas(status, scheduled_at) WHERE status = 'agendada';
ALTER TABLE public.llamadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages llamadas" ON public.llamadas;
CREATE POLICY "Admin manages llamadas" ON public.llamadas
  FOR ALL USING (public.is_admin());

-- 5) Pipeline en lead_quiz_responses (C: setter)
-- Wrap en DO en caso de que lead_quiz_responses no exista todavía.
DO $$ BEGIN
  ALTER TABLE public.lead_quiz_responses
    ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'nuevo'
      CHECK (stage IN ('nuevo', 'contactado', 'agendado', 'no_show', 'convertido', 'descartado')),
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS converted_user_id UUID REFERENCES public.users ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

  -- Backfill stage desde booked/disqualified existentes
  UPDATE public.lead_quiz_responses
     SET stage = CASE
       WHEN disqualified THEN 'descartado'
       WHEN booked THEN 'agendado'
       ELSE 'nuevo'
     END
   WHERE stage = 'nuevo';

  CREATE INDEX IF NOT EXISTS idx_leads_stage
    ON public.lead_quiz_responses(stage, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_assigned
    ON public.lead_quiz_responses(assigned_to) WHERE assigned_to IS NOT NULL;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'lead_quiz_responses no existe todavía — skip pipeline setter';
END $$;

-- 6) lead_contacts — historial de outreach por lead
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.lead_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.lead_quiz_responses ON DELETE CASCADE NOT NULL,
    canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'instagram', 'email', 'telefono', 'otro')),
    direccion TEXT NOT NULL CHECK (direccion IN ('saliente', 'entrante')),
    nota TEXT,
    hecho_por UUID REFERENCES public.users ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead
    ON public.lead_contacts(lead_id, created_at DESC);
  ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Admin manages lead contacts" ON public.lead_contacts;
  CREATE POLICY "Admin manages lead contacts" ON public.lead_contacts
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'lead_quiz_responses no existe todavía — skip lead_contacts';
END $$;

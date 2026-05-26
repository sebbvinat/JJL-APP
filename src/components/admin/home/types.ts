/** Tipo unificado para students enriquecidos del CRM. */
export type CrmStudent = {
  id: string;
  nombre: string;
  email: string | null;
  avatar_url: string | null;
  cinturon_actual: string;
  rol: string;
  planilla_id?: string | null;
  program_member?: boolean;
  tags?: string[];
  lifecycle_stage?: 'prospect' | 'onboarding' | 'active' | 'at_risk' | 'paused' | 'churned';
  created_at?: string;
  started_at?: string | null;
  unlocked_count: number;
  notes_count?: number;
  // Enriched (cuando endpoint llamado con ?enrich=1)
  last_contact_at?: string | null;
  eligible_1on1_at?: string | null;
  days_in_program?: number | null;
  current_mes_label?: string | null;
  current_mes_percent?: number;
  next_mes_label?: string | null;
  is_eligible_1on1?: boolean;
  days_since_activity?: number | null;
  alerts?: { kind: string; severity: 'critical' | 'warn' | 'info'; label: string }[];
  health_streak?: number;
};

export type FilterState = {
  q: string;
  quick: 'all' | 'active' | 'at_risk' | 'ready_1on1' | 'inactive' | 'no_lifecycle';
  belt: string | null;
  lifecycle: string | null;
  tag: string | null;
};

// Verifica qué columnas existen REALMENTE en la DB de producción.
// Diagnóstico del bug "column doesn't exist": queremos saber si las
// migrations recientes (crm_foundation, lead_sales_and_setter_guide,
// user_tags, program_member) se aplicaron de verdad.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// Trae 1 fila de cada tabla y lista sus columnas reales.
async function cols(table) {
  const { data, error } = await sb.from(table).select('*').limit(1);
  if (error) return { table, error: error.message };
  const row = data?.[0];
  return { table, columns: row ? Object.keys(row).sort() : '(tabla vacía — no puedo inferir columnas)' };
}

const TABLES = ['users', 'course_data', 'user_access', 'user_progress', 'daily_tasks',
  'lead_quiz_responses', 'lead_sales'];

// Columnas críticas que el código de hoy referencia:
const CRITICAL = {
  users: ['lifecycle_stage', 'started_at', 'setter_guide_seen_at', 'program_member', 'tags', 'planilla_id', 'onboarding_step', 'onboarding_completed_at', 'cinturon_actual', 'puntos'],
  lead_quiz_responses: ['stage', 'booked', 'urgencia', 'disqualified', 'assigned_to', 'setter_notified_booked_at'],
};

console.log('=== COLUMNAS REALES EN PRODUCCIÓN ===\n');
for (const t of TABLES) {
  const r = await cols(t);
  if (r.error) { console.log(`❌ ${t}: ERROR — ${r.error}\n`); continue; }
  console.log(`📋 ${t}:`);
  if (Array.isArray(r.columns)) {
    // Chequeo de columnas críticas
    const crit = CRITICAL[t];
    if (crit) {
      for (const c of crit) {
        const exists = r.columns.includes(c);
        console.log(`   ${exists ? '✅' : '🔴 FALTA'} ${c}`);
      }
    } else {
      console.log(`   (${r.columns.length} columnas)`);
    }
  } else {
    console.log(`   ⚠ ${r.columns}`);
  }
  console.log('');
}
console.log('=== FIN ===');

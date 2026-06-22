// WRITE: swap por TITULO (no por module_id) para soportar tanto data
// vieja como nueva mezclada. Solo cambia semana_numero:
//   "100KG + Kimura"           -> semana 8
//   "Armbar + Guardia Cerrada" -> semana 7
// Idempotente. Reversible: scripts/kimura-armbar-backup-*.json
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const swaps = [
  { titulo: '100KG + Kimura', semana_numero: 8 },
  { titulo: 'Armbar + Guardia Cerrada', semana_numero: 7 },
];

for (const s of swaps) {
  const { data, error } = await sb.from('course_data')
    .update({ semana_numero: s.semana_numero, updated_at: new Date().toISOString() })
    .eq('titulo', s.titulo)
    .select('user_id, module_id');
  if (error) { console.error(`FALLO ${s.titulo}: ${error.message}`); process.exit(1); }
  console.log(`"${s.titulo}" -> semana ${s.semana_numero}  (${data.length} filas)`);
}

// Verificacion
const { data: chk } = await sb.from('course_data')
  .select('module_id, semana_numero, titulo')
  .or('titulo.eq.100KG + Kimura,titulo.eq.Armbar + Guardia Cerrada,titulo.eq.Escape 100KG I,titulo.eq.Escape 100KG II');
const seen = new Set();
for (const r of chk || []) seen.add(`sem ${r.semana_numero} | ${r.module_id} | "${r.titulo}"`);
console.log('\nEstado final (distintos):');
for (const s of [...seen].sort()) console.log('  ' + s);

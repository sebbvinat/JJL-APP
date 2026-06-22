// READ-ONLY backup de mod-5 y mod-6 antes del swap kimura<->armbar.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await sb.from('course_data').select('*').in('module_id', ['mod-5', 'mod-6']);
if (error) { console.error('ERROR:', error.message); process.exit(1); }
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(new URL(`./kimura-armbar-backup-${stamp}.json`, import.meta.url), JSON.stringify(data, null, 2), 'utf8');
const by = {};
for (const r of data) by[r.module_id] = (by[r.module_id] || 0) + 1;
console.log(`Backup OK: ${data.length} filas -> scripts/kimura-armbar-backup-${stamp}.json`, JSON.stringify(by));
console.log('semana_numero actual:', [...new Set(data.map((r) => `${r.module_id}=${r.semana_numero}(${r.titulo})`))].join(', '));

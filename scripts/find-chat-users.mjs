// Diagnóstico: encontrar las cuentas relevantes para insertar mensajes de chat.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// Admins
const { data: admins } = await sb.from('users').select('id, nombre, email, rol, tags').eq('rol', 'admin');
console.log('=== ADMINS ===');
for (const a of admins || []) console.log(`  ${a.nombre}  <${a.email}>  tags=${JSON.stringify(a.tags)}  id=${a.id}`);

// Usuarios con nombre relevante
console.log('\n=== USUARIOS Seba / Viñat / Guido ===');
const { data: users } = await sb.from('users')
  .select('id, nombre, email, rol')
  .or('nombre.ilike.%seba%,nombre.ilike.%vi%at%,nombre.ilike.%guido%,email.ilike.%guido%,email.ilike.%seba%');
for (const u of users || []) console.log(`  ${u.nombre}  <${u.email}>  rol=${u.rol}  id=${u.id}`);

console.log('\n=== TOTAL usuarios alumno (primeros 10) ===');
const { data: alumnos } = await sb.from('users').select('id, nombre, email').eq('rol', 'alumno').limit(10);
for (const u of alumnos || []) console.log(`  ${u.nombre}  <${u.email}>`);

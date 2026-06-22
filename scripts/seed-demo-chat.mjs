// Crea una cuenta demo "Seba Viñat" (alumno) e inserta 2 mensajes de chat
// en SU canal. El modelo de chat de la app guarda cada mensaje con
// to_user_id = el id del ALUMNO (su canal privado), sin importar quién
// escribe — así lo hace el POST de /api/messages (alumno envía →
// to_user_id = channelId = su propio id). El admin ve ese canal al elegir
// al alumno en la lista. Si se pone to_user_id = ADMIN_ID, los mensajes no
// aparecen ni para el alumno ni para el admin (el canal queda vacío).
//
// 100% reversible: al final imprime el comando de limpieza.
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const ADMIN_ID = '94a4a249-852e-4d08-9de9-3e9b131f6bb6'; // Sebb <sebastianvinat@gmail.com>
const DEMO_EMAIL = 'seba.demo@jjl.local';
const DEMO_NOMBRE = 'Seba Viñat';

// ── Modo cleanup: borra la cuenta demo (CASCADE borra sus mensajes). ──
if (process.argv.includes('--cleanup')) {
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = (list?.users || []).find((u) => u.email === DEMO_EMAIL);
  if (!existing) { console.log('No hay cuenta demo que borrar.'); process.exit(0); }
  // Borrar mensajes explícitamente (por si el CASCADE no cubre algo).
  await sb.from('messages').delete().or(`from_user_id.eq.${existing.id},to_user_id.eq.${existing.id}`);
  const { error } = await sb.auth.admin.deleteUser(existing.id);
  if (error) { console.error('Error borrando cuenta demo:', error.message); process.exit(1); }
  console.log('✔ Cuenta demo "Seba Viñat" + sus mensajes BORRADOS.');
  process.exit(0);
}

// 1. Crear (o reusar) la cuenta demo en auth.
let demoId = null;
const { data: created, error: createErr } = await sb.auth.admin.createUser({
  email: DEMO_EMAIL,
  password: crypto.randomUUID() + 'Aa1!',
  email_confirm: true,
  user_metadata: { nombre: DEMO_NOMBRE, full_name: DEMO_NOMBRE },
});
if (createErr) {
  // Ya existe → buscarlo en la lista.
  console.log(`createUser: ${createErr.message} — busco la cuenta existente…`);
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = (list?.users || []).find((u) => u.email === DEMO_EMAIL);
  if (!existing) { console.error('No pude crear ni encontrar la cuenta demo. Abort.'); process.exit(1); }
  demoId = existing.id;
} else {
  demoId = created.user.id;
}
console.log(`✔ Cuenta demo: ${DEMO_NOMBRE} <${DEMO_EMAIL}> id=${demoId}`);

// 2. Upsert del row en public.users (por si el trigger no lo creó o le falta nombre).
// program_member: true es necesario — sin esto, al completar el onboarding el
// gate "alumno fantasma" del middleware (rol=alumno + program_member=false +
// onboarding completo) lo redirige fuera, a jiujitsulatino.com/mis-cursos, y
// el demo no puede entrar al dashboard.
const { error: upErr } = await sb.from('users').upsert(
  { id: demoId, nombre: DEMO_NOMBRE, email: DEMO_EMAIL, rol: 'alumno', program_member: true },
  { onConflict: 'id' },
);
if (upErr) { console.error('Error upsert users:', upErr.message); process.exit(1); }
console.log('✔ Fila public.users lista (rol=alumno).');

// 3. Insertar los 2 mensajes (de la cuenta demo → admin Sebb).
const now = Date.now();
// to_user_id = demoId (el canal del propio alumno), NO ADMIN_ID. Ver nota arriba.
const msgs = [
  {
    from_user_id: demoId,
    to_user_id: demoId,
    contenido: 'Increible, siento la diferencia en trabajar en los detalles. Los estoy aplasando a todos jajajjaa',
    leido: false,
    created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // hace 2h (arriba)
  },
  {
    from_user_id: demoId,
    to_user_id: demoId,
    contenido: 'Hola Guido venimos bien, ya termine el modulo de esta semana, subi los videos para que me corrigas. Necesitaba tener un norte y creo que me estoy encontrando mas comodo al momento de pelear como que se adonde tengo que ir y busco eso no se si me explico',
    leido: false,
    created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // hace 1h (abajo)
  },
];
const { data: inserted, error: msgErr } = await sb.from('messages').insert(msgs).select('id, created_at');
if (msgErr) { console.error('Error insertando mensajes:', msgErr.message); process.exit(1); }
console.log(`✔ ${inserted.length} mensajes insertados:`);
for (const m of inserted) console.log(`   id=${m.id}  ${m.created_at}`);

console.log('\n✅ LISTO. Entrá al chat como admin (Sebb) → vas a ver la conversación con "Seba Viñat".');
console.log('\n--- Para BORRAR todo esto después (reversible) ---');
console.log(`Demo user id: ${demoId}`);
console.log('Correr: node scripts/seed-demo-chat.mjs --cleanup');

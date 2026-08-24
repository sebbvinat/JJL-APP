// Simula un checkout.session.completed firmado contra el webhook local,
// para probar el fulfillment sin depender de Stripe ni de una compra real.
//
// Uso: node --env-file=.env.local migration/test-stripe-webhook.mjs [--cleanup]

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const CLEANUP = process.argv.includes('--cleanup');
const URL = 'http://localhost:3000/api/cursos/stripe/webhook';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const TEST_EMAIL = 'test-webhook-jjl@example.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function findUser(email) {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
}

if (CLEANUP) {
  const u = await findUser(TEST_EMAIL);
  if (!u) {
    console.log('No hay usuario de prueba que limpiar.');
    process.exit(0);
  }
  await supabase.from('cursos_access').delete().eq('user_id', u.id);
  await supabase.from('users').delete().eq('id', u.id);
  await supabase.auth.admin.deleteUser(u.id);
  console.log(`✓ Usuario de prueba ${TEST_EMAIL} eliminado.`);
  process.exit(0);
}

if (!SECRET) {
  console.error('Falta STRIPE_WEBHOOK_SECRET en .env.local');
  process.exit(1);
}

// Limpiar antes por si quedó de una corrida anterior
const prev = await findUser(TEST_EMAIL);
if (prev) {
  await supabase.from('cursos_access').delete().eq('user_id', prev.id);
  await supabase.from('users').delete().eq('id', prev.id);
  await supabase.auth.admin.deleteUser(prev.id);
  console.log('(limpieza previa hecha)');
}

const event = {
  id: 'evt_test_' + crypto.randomBytes(8).toString('hex'),
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_' + crypto.randomBytes(8).toString('hex'),
      payment_link: 'plink_1U7wpMCl9ClSszOM8LnWZaKv', // ADN
      payment_status: 'paid',
      amount_total: 10700,
      currency: 'usd',
      customer_details: { email: TEST_EMAIL, name: 'Test Webhook' },
    },
  },
};

const payload = JSON.stringify(event);
const ts = Math.floor(Date.now() / 1000);
const sig = crypto
  .createHmac('sha256', SECRET)
  .update(`${ts}.${payload}`, 'utf8')
  .digest('hex');

console.log(`POST ${URL}`);
const res = await fetch(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': `t=${ts},v1=${sig}`,
  },
  body: payload,
});
console.log(`→ HTTP ${res.status}: ${await res.text()}`);

// Verificar el resultado en la DB
await new Promise((r) => setTimeout(r, 1500));
const user = await findUser(TEST_EMAIL);
if (!user) {
  console.log('\n✗ No se creó el usuario.');
  process.exit(1);
}
console.log(`\n✓ Usuario creado: ${user.id}`);

const { data: profile } = await supabase
  .from('users')
  .select('nombre, rol')
  .eq('id', user.id)
  .single();
console.log(`  nombre="${profile?.nombre}" rol=${profile?.rol}`);

const { data: grants } = await supabase
  .from('cursos_access')
  .select('expires_at, notas, source_bundle_id, cursos_courses(slug)')
  .eq('user_id', user.id);
console.log(`\n✓ Accesos otorgados: ${grants?.length || 0}`);
grants?.forEach((g) =>
  console.log(`  ${g.cursos_courses?.slug} — vence ${g.expires_at?.slice(0, 10)} — ${g.notas}`)
);

// Idempotencia: reenviar el mismo evento no debe duplicar ni re-mailear
console.log('\n--- reenvío del mismo evento (idempotencia) ---');
const res2 = await fetch(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': `t=${ts},v1=${sig}`,
  },
  body: payload,
});
console.log(`→ HTTP ${res2.status}`);
const { data: grants2 } = await supabase
  .from('cursos_access')
  .select('id')
  .eq('user_id', user.id);
console.log(`  accesos después del reenvío: ${grants2?.length} (esperado ${grants?.length})`);

console.log('\nPara limpiar: node --env-file=.env.local migration/test-stripe-webhook.mjs --cleanup');

// Control del embudo: imprime las 6 vistas de Looker para compararlas con lo
// que muestra Looker Studio y con el CRM. SOLO LECTURA: no escribe nada.
//
// Por qué existe: Looker lee estas mismas vistas. Si un gráfico da un número
// raro, acá se ve en diez segundos si el problema está en la base (la vista da
// mal) o en Looker (la vista da bien y el gráfico está mal armado).
//
// Uso:
//   node scripts/embudo-check.mjs                 últimos 30 días, sin nombres
//   node scripts/embudo-check.mjs --dias=7        otra ventana
//   node scripts/embudo-check.mjs --con-nombres   muestra nombres (NO pegar esa
//                                                 salida en chats ni informes)
//
// Sale con código 1 si falta alguna vista, si un control cruzado no cierra o si
// una vista quedó legible con la clave pública. Así sirve también para QA.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── Entorno ────────────────────────────────────────────────────────────────
// Mismo patrón que scripts/check-schema.mjs: se lee .env.local a mano para que
// ande con `node scripts/embudo-check.mjs` a secas. Las claves nunca se imprimen.
function leerEnv() {
  let texto = '';
  try {
    texto = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    // Sin archivo todavía puede andar si las variables ya vienen en el entorno
    // (por ejemplo con `node --env-file=.env.local`).
  }
  const delArchivo = Object.fromEntries(
    texto
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        // En Windows quedan comillas y retornos de carro pegados al valor.
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
  return { ...delArchivo, ...process.env };
}

const env = leerEnv();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE_SERVICIO = env.SUPABASE_SERVICE_ROLE_KEY;
const CLAVE_PUBLICA = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_SUPABASE || !CLAVE_SERVICIO) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local. No se puede leer la base.');
  process.exit(1);
}

const sinSesion = { auth: { autoRefreshToken: false, persistSession: false } };
const sb = createClient(URL_SUPABASE, CLAVE_SERVICIO, sinSesion);

// ── Argumentos ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argDias = args.find((a) => a.startsWith('--dias='));
const DIAS = Math.max(1, Number(argDias?.split('=')[1]) || 30);
const CON_NOMBRES = args.includes('--con-nombres');

// Las vistas cortan el día en hora de Buenos Aires, así que la ventana también.
const fechaBA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});
const DESDE = fechaBA.format(new Date(Date.now() - DIAS * 86_400_000)); // YYYY-MM-DD
const DESDE_MES = `${DESDE.slice(0, 7)}-01`;

const MIG_EMBUDO = 'supabase/migrations/2026_09_09_vistas_embudo_looker.sql';
const MIG_VENTAS = 'supabase/migrations/2026_09_20_vistas_ventas_setter.sql';

// ── Utilidades ─────────────────────────────────────────────────────────────
/** "Juan Pérez" -> "J.P." Para poder comparar por setter sin pegar nombres. */
function iniciales(nombre) {
  if (!nombre || nombre === 'Sin setter') return nombre || '';
  return nombre.split(' ').filter(Boolean).map((p) => `${p[0].toUpperCase()}.`).join('');
}

/** ¿El error es "esa vista no existe"? PostgREST y Postgres lo dicen distinto. */
function esVistaInexistente(error) {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01'
    || /could not find the table|does not exist/i.test(error.message || '');
}

const titulo = (t) => console.log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`);

/**
 * Lee una vista. Nunca tira: devuelve { filas } o { falta } o { error }.
 * El tope de 1000 es el de la API de Supabase; si se llega, se avisa para que
 * nadie compare contra un total cortado.
 */
async function leer(vista, armar) {
  try {
    const { data, error } = await armar(sb.from(vista).select('*')).range(0, 999);
    if (esVistaInexistente(error)) return { falta: true };
    if (error) return { error: `${error.code || ''} ${error.message}`.trim() };
    return { filas: data || [], cortado: (data || []).length === 1000 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Cuenta filas de una tabla o vista sin traerlas. Devuelve null si no se pudo. */
async function contar(tabla, filtrar = (q) => q) {
  try {
    const { count, error } = await filtrar(sb.from(tabla).select('*', { count: 'exact', head: true }));
    return error ? null : count;
  } catch {
    return null;
  }
}

const sumar = (filas, col) => filas.reduce((a, f) => a + (Number(f[col]) || 0), 0);

// ── Las 6 vistas ───────────────────────────────────────────────────────────
// `mostrar` recibe las filas y devuelve lo que se imprime. Las dos vistas con
// datos de personas (recuperables y ventas) no muestran nombres salvo que se
// pida: la salida de este script termina pegada en informes.
const VISTAS = [
  {
    nombre: 'v_embudo_diario',
    migracion: MIG_EMBUDO,
    que: `Formulario, día por día (desde ${DESDE})`,
    armar: (q) => q.gte('fecha', DESDE).order('fecha', { ascending: false }),
    mostrar: (filas) => filas,
  },
  {
    nombre: 'v_embudo_quiz_diario',
    migracion: MIG_EMBUDO,
    que: `Quiz "a qué luchador te parecés", día por día (desde ${DESDE})`,
    armar: (q) => q.gte('fecha', DESDE).order('fecha', { ascending: false }),
    mostrar: (filas) => filas,
  },
  {
    nombre: 'v_leads_recuperables',
    migracion: MIG_EMBUDO,
    que: `Recuperables por motivo (desde ${DESDE})`,
    armar: (q) => q.gte('fecha', DESDE).order('created_at', { ascending: false }),
    mostrar: (filas) => {
      if (CON_NOMBRES) {
        return filas.slice(0, 50).map((f) => ({
          fecha: f.fecha, motivo: f.motivo, nombre: f.nombre, instagram: f.instagram, stage: f.stage, dias: f.dias,
        }));
      }
      const porMotivo = new Map();
      for (const f of filas) {
        const m = porMotivo.get(f.motivo) || { motivo: f.motivo, leads: 0, con_instagram: 0, con_telefono: 0, con_email: 0, sin_contactar: 0 };
        m.leads += 1;
        if (f.instagram) m.con_instagram += 1;
        if (f.telefono) m.con_telefono += 1;
        if (f.email) m.con_email += 1;
        if (!f.last_contact_at) m.sin_contactar += 1;
        porMotivo.set(f.motivo, m);
      }
      return [...porMotivo.values()].sort((a, b) => String(a.motivo).localeCompare(String(b.motivo)));
    },
  },
  {
    nombre: 'v_agendas_registradas',
    migracion: MIG_EMBUDO,
    que: `Agendas que la app registró (desde ${DESDE})`,
    armar: (q) => q.gte('fecha', DESDE).order('fecha', { ascending: false }),
    mostrar: (filas) => filas,
  },
  {
    nombre: 'v_ventas',
    migracion: MIG_VENTAS,
    que: `Ventas, una fila por cobro (desde ${DESDE})`,
    armar: (q) => q.gte('fecha', DESDE).order('fecha', { ascending: false }),
    mostrar: (filas) => filas.map((f) => ({
      fecha: f.fecha,
      tipo: f.is_fee ? 'fee' : 'venta',
      monto: f.monto,
      moneda: f.moneda,
      source: f.source,
      ...(CON_NOMBRES ? { nombre: f.nombre } : {}),
      // Solo el número del origen ("1." a "4."); la leyenda está en docs/looker.md.
      origen_lead: String(f.origen_lead || '').slice(0, 2),
      setter: CON_NOMBRES ? f.setter : iniciales(f.setter),
    })),
  },
  {
    nombre: 'v_embudo_mensual',
    migracion: MIG_VENTAS,
    que: `De lead a plata, mes por mes (desde ${DESDE_MES})`,
    armar: (q) => q.gte('mes', DESDE_MES).order('mes', { ascending: false }),
    mostrar: (filas) => filas.map((f) => {
      const limpio = { ...f };
      delete limpio.mes; // mes_texto dice lo mismo y ocupa menos
      return limpio;
    }),
  },
];

// ── Corrida ────────────────────────────────────────────────────────────────
console.log(`CONTROL DEL EMBUDO — últimos ${DIAS} días (desde ${DESDE}, hora de Buenos Aires)`);
console.log(CON_NOMBRES
  ? 'ATENCIÓN: salida CON nombres de personas. No pegarla en chats ni informes.'
  : 'Sin nombres de personas (usar --con-nombres para verlos).');

const faltan = [];
const conError = [];
const leidas = new Map();

for (const v of VISTAS) {
  titulo(`${v.nombre} — ${v.que}`);
  const r = await leer(v.nombre, v.armar);
  if (r.falta) {
    faltan.push(v);
    console.log(`FALTA: la vista ${v.nombre} todavía no existe en la base.`);
    console.log(`       Se crea corriendo ${v.migracion} en el SQL editor de Supabase.`);
    continue;
  }
  if (r.error) {
    conError.push({ vista: v.nombre, error: r.error });
    console.log(`ERROR al leer ${v.nombre}: ${r.error}`);
    continue;
  }
  leidas.set(v.nombre, r.filas);
  if (r.filas.length === 0) {
    console.log('(sin filas en la ventana)');
    continue;
  }
  console.table(v.mostrar(r.filas));
  if (r.cortado) console.log('OJO: se llegó al tope de 1000 filas de la API. Los totales de arriba están cortados; achicar --dias.');
}

// ── Controles cruzados: la vista contra la tabla ───────────────────────────
// Una vista con joins puede duplicar o perder filas sin dar error (un lead con
// dos matches duplica la venta y el monto se infla en Looker). Estos controles
// comparan contra la tabla cruda, que es la verdad.
titulo('CONTROLES CRUZADOS (vista contra tabla)');
const controles = [];
function control(nombre, esperado, obtenido) {
  if (esperado === null || obtenido === null) {
    controles.push({ control: nombre, tabla: esperado ?? 'n/d', vista: obtenido ?? 'n/d', resultado: 'no se pudo medir' });
    return;
  }
  controles.push({ control: nombre, tabla: esperado, vista: obtenido, resultado: esperado === obtenido ? 'OK' : 'NO CIERRA' });
}

const totalVentas = await contar('lead_sales');
const totalLeads = await contar('lead_quiz_responses');
const porSource = {};
for (const s of ['crm', 'crm_ventas', 'manual']) {
  porSource[s] = await contar('lead_sales', (q) => q.eq('source', s));
}
console.log(`En las tablas hoy: ${totalVentas ?? 'n/d'} filas en lead_sales (${Object.entries(porSource).map(([k, n]) => `${n ?? 'n/d'} ${k}`).join(', ')}) y ${totalLeads ?? 'n/d'} leads.`);
console.log('Eso es lo que v_ventas y v_embudo_mensual tienen que sumar en toda la historia.\n');

if (leidas.has('v_ventas')) {
  control('v_ventas: una fila por venta (toda la historia)', totalVentas, await contar('v_ventas'));
  for (const s of Object.keys(porSource)) {
    control(`v_ventas: filas con source = ${s}`, porSource[s], await contar('v_ventas', (q) => q.eq('source', s)));
  }
}
if (leidas.has('v_embudo_mensual')) {
  const todos = await leer('v_embudo_mensual', (q) => q.order('mes', { ascending: false }));
  if (todos.filas) {
    control('v_embudo_mensual: suma de leads', totalLeads, sumar(todos.filas, 'leads'));
    control('v_embudo_mensual: suma de ventas + fees', totalVentas, sumar(todos.filas, 'ventas') + sumar(todos.filas, 'fees'));
  }
}
if (leidas.has('v_embudo_diario')) {
  // -03:00 fijo: Argentina no tiene horario de verano.
  const leadsVentana = await contar('lead_quiz_responses', (q) => q.gte('created_at', `${DESDE}T00:00:00-03:00`));
  control(`v_embudo_diario: formularios desde ${DESDE}`, leadsVentana, sumar(leidas.get('v_embudo_diario'), 'completaron_form'));
}
if (controles.length > 0) console.table(controles);
else console.log('Todavía no hay vistas para controlar.');

// ── Exposición: ¿la clave pública puede leer las vistas? ───────────────────
// Una vista en Supabase nace legible para `anon` y se saltea RLS (corre como
// su dueño). v_leads_recuperables tiene teléfonos y mails: si la clave que
// viaja en el navegador la puede leer, es una fuga. La migración de ventas les
// saca el permiso; esto confirma que quedó bien.
titulo('EXPOSICIÓN (lectura con la clave pública de la app)');
const expuestas = [];
if (!CLAVE_PUBLICA) {
  console.log('No hay NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno: no se pudo probar.');
} else if (leidas.size === 0) {
  console.log('No hay vistas creadas: nada que probar todavía.');
} else {
  const publico = createClient(URL_SUPABASE, CLAVE_PUBLICA, sinSesion);
  const filas = [];
  for (const nombre of leidas.keys()) {
    let resultado;
    try {
      // Se pide una sola fila y NO se imprime: alcanza con saber si la deja leer.
      const { error } = await publico.from(nombre).select('*').limit(1);
      if (!error) { resultado = 'EXPUESTA: la clave pública la puede leer'; expuestas.push(nombre); }
      else if (error.code === '42501') resultado = 'OK (permiso denegado)';
      else resultado = `OK (no la ve: ${error.code || error.message})`;
    } catch (err) {
      resultado = `no se pudo probar: ${err instanceof Error ? err.message : String(err)}`;
    }
    filas.push({ vista: nombre, resultado });
  }
  console.table(filas);
  if (expuestas.length > 0) {
    console.log(`Se arregla corriendo ${MIG_VENTAS} (la sección 3 les saca el permiso a anon y authenticated).`);
  }
}

// ── Resumen ────────────────────────────────────────────────────────────────
titulo('RESUMEN');
const noCierran = controles.filter((c) => c.resultado === 'NO CIERRA');
console.log(`Vistas leídas: ${leidas.size} de ${VISTAS.length}.`);
if (faltan.length > 0) {
  console.log(`Faltan ${faltan.length}: ${faltan.map((v) => v.nombre).join(', ')}.`);
  for (const mig of [...new Set(faltan.map((v) => v.migracion))]) console.log(`  -> correr ${mig}`);
}
if (conError.length > 0) console.log(`Con error: ${conError.map((e) => `${e.vista} (${e.error})`).join('; ')}.`);
if (noCierran.length > 0) console.log(`Controles que NO cierran: ${noCierran.map((c) => c.control).join('; ')}.`);
if (expuestas.length > 0) console.log(`Vistas EXPUESTAS a la clave pública: ${expuestas.join(', ')}.`);

const todoBien = faltan.length === 0 && conError.length === 0 && noCierran.length === 0 && expuestas.length === 0;
console.log(todoBien ? 'Todo en orden.' : 'Hay cosas para resolver (ver arriba).');
process.exitCode = todoBien ? 0 : 1;

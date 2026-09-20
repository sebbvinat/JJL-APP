// Recupera los usuarios de Instagram a los que el bug del 29/8 les borró las "s".
//
// QUÉ PASÓ. Entre el 29/8 (commit dfdc5cb) y el 9/9 (commit 5fece7d), la función
// `instagramDeLaUrl()` del formulario de consultoría limpiaba el usuario que viene
// en el link (`?ig=...`) con replace(/s+/g, '') en vez de la versión con barra
// invertida (espacios). Resultado: a todo usuario que llegó POR EL LINK se le
// borraron las "s" minúsculas antes de guardarlo. El setter le escribe a una
// cuenta que no existe.
//
// QUÉ NO PASÓ (y por eso este script no adivina). El que escribió su usuario A
// MANO pasó por otra limpieza, que estaba bien. O sea: si el link guardado en
// `referrer` no trae `?ig=`, el bug no tocó esa fila. No hay nada que "recuperar"
// ahí, y ponerle "s" a ojo sería inventar. Esas filas solo se listan para revisar
// cuando lo guardado directamente no parece un usuario (un mail, "si", un nombre).
//
// FUENTES, en orden de confianza:
//   1. `referrer` de la propia fila: es el link original, con el usuario intacto.
//   2. Quiz del luchador (`match_quiz_responses`): nunca tuvo el bug. Se cruza por
//      teléfono, que es lo único que identifica a la misma persona sin dudas. Por
//      nombre solo se deja una pista en el CSV, no se aplica nada.
//   3. Calendly (pregunta "REF", parámetro `a4`). OJO: durante el bug, el `a4` se
//      armaba con el usuario YA roto, así que si Calendly dice lo mismo que la base
//      eso no confirma nada (es la misma fuente envenenada). Solo suma cuando trae
//      algo distinto. Necesita CALENDLY_TOKEN; si no está, se saltea y se avisa.
//
// REGLA PARA CORREGIR (las dos a la vez):
//   a) al candidato, sacándole las "s" minúsculas igual que hacía el bug, le queda
//      EXACTAMENTE lo guardado. El plan permitía también "prefijo/sufijo obvio";
//      acá eso se manda a revisión a propósito: cambiar mal un usuario es peor que
//      dejarlo como está.
//   b) ninguna fuente disponible dice otra cosa.
//
// USO (desde la raíz del repo):
//   node --env-file=.env.local scripts/recuperar-handles.mjs                 -> dry-run (no escribe en la base)
//   node --env-file=.env.local scripts/recuperar-handles.mjs --aplicar       -> backup + update + nota en el lead
//   node --env-file=.env.local scripts/recuperar-handles.mjs --aplicar --solo a7f1eb7e,66921354
//   node --env-file=.env.local scripts/recuperar-handles.mjs --restaurar scripts/backups/handles-backup-<fecha>.json [--solo a7f1eb7e] [--aplicar]
//
// `--dry` y `--aplicar` juntos se rechazan: no se adivina cuál quiso la persona.
// `--aplicar` recién después de que Sebastián apruebe el listado del dry-run.
// Nunca imprime claves. Solo toca `lead_quiz_responses.instagram` y agrega una
// nota en `lead_contacts`. No toca `match_quiz_responses` ni `last_contact_at`
// (nadie contactó al lead; moverlo le cambiaría el orden de seguimiento al setter).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

// Rango fijo y cerrado a propósito: el script no puede proponer nada fuera de
// estas fechas aunque alguien lo corra dentro de seis meses. El bug salió el
// 29/8 19:47 (-03) y el arreglo el 9/9 08:49 (-03); se toma del 29/8 00:00 UTC
// al 10/9 00:00 UTC (exclusivo), que son las 58 filas del diagnóstico.
const DESDE = '2026-08-29T00:00:00Z';
const HASTA = '2026-09-10T00:00:00Z';

// Lo que Instagram acepta como usuario. Misma expresión que usa el formulario.
const HANDLE_VALIDO = /^[A-Za-z0-9._]{1,30}$/;

const DIR_BACKUPS = new URL('./backups/', import.meta.url);

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const iRest = args.indexOf('--restaurar');
const ARCHIVO_RESTAURAR = iRest >= 0 ? args[iRest + 1] : null;
const iSolo = args.indexOf('--solo');
const SOLO = iSolo >= 0 && args[iSolo + 1]
  ? args[iSolo + 1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : null;

const conocidos = new Set(['--dry', '--aplicar', '--restaurar', '--solo']);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--') && !conocidos.has(a)) {
    // Un flag mal escrito (ej. "--aplica") no puede terminar siendo un dry-run
    // silencioso que el que lo corre confunde con "ya lo apliqué".
    console.error(`Opción desconocida: ${a}. Opciones: --dry (default), --aplicar, --solo <ids>, --restaurar <archivo>.`);
    process.exit(2);
  }
  // Argumento suelto (sin "--" y que no es el valor de --solo / --restaurar).
  // No se puede ignorar en silencio: --solo es lo único que achica el alcance de
  // --aplicar, así que "--aplicar a7f1eb7e,66921354" (sin la palabra --solo)
  // terminaría corrigiendo TODO, y "--solo a7f1eb7e, 66921354" (con espacio)
  // aplicaría uno solo sin avisar. Ante la duda, no se hace nada.
  const esValor = (iSolo >= 0 && i === iSolo + 1) || (iRest >= 0 && i === iRest + 1);
  if (!a.startsWith('--') && !esValor) {
    console.error(`Argumento suelto: "${a}". ¿Te faltó --solo? Los ids van pegados, separados por coma y sin espacios: --solo a7f1eb7e,66921354. No se hizo nada.`);
    process.exit(2);
  }
}
if (args.filter((a) => a === '--solo').length > 1 || args.filter((a) => a === '--restaurar').length > 1) {
  // Solo se lee la primera aparición; una segunda quedaría ignorada en silencio.
  console.error('--solo y --restaurar van una sola vez cada uno. No se hizo nada.');
  process.exit(2);
}
if (args.includes('--dry') && APLICAR) {
  // Los dos juntos se contradicen, y si ganara --aplicar se escribiría en
  // producción justo cuando la persona pidió mirar sin tocar (caso típico: subir
  // con la flecha el comando anterior y agregarle --dry). Ante la duda, no se hace nada.
  console.error('--dry y --aplicar se contradicen. Dejá uno solo. No se hizo nada.');
  process.exit(2);
}
if (iRest >= 0 && (!ARCHIVO_RESTAURAR || ARCHIVO_RESTAURAR.startsWith('--'))) {
  console.error('Falta el archivo: --restaurar scripts/backups/handles-backup-<fecha>.json');
  process.exit(2);
}
if (iSolo >= 0 && (!SOLO || SOLO.length === 0 || SOLO.some((s) => s.startsWith('--')))) {
  // Un "--solo" sin lista no puede caer en "aplicar todo": es justo lo contrario
  // de lo que quiso el que lo escribió.
  console.error('Falta la lista: --solo a7f1eb7e,66921354 (primeros 8 del session_id, separados por coma).');
  process.exit(2);
}
if (SOLO) {
  // Cada id tiene que traer como mínimo los 8 hexadecimales que muestra el
  // informe (se acepta el session_id entero). Como se compara por prefijo, un
  // "--solo a" agarraría a659fca2 y a7f1eb7e a la vez: más filas de las aprobadas.
  const malos = SOLO.filter((s) => !/^[0-9a-f]{8}[0-9a-f-]*$/.test(s));
  if (malos.length > 0) {
    console.error(`Id inválido en --solo: ${malos.join(', ')}. Van los primeros 8 caracteres del session_id (hexadecimales), ej. a7f1eb7e. No se hizo nada.`);
    process.exit(2);
  }
}

/**
 * Variables de entorno: primero las del proceso (`node --env-file=.env.local`),
 * y si no están, se lee `.env.local` a mano (patrón de scripts/check-schema.mjs).
 * Así el script anda igual de las dos formas y nunca hace falta pegar una clave.
 */
function leerEnv() {
  const salida = { ...process.env };
  const ruta = new URL('../.env.local', import.meta.url);
  if (existsSync(ruta)) {
    for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      if (!linea || linea.startsWith('#') || !linea.includes('=')) continue;
      const i = linea.indexOf('=');
      const k = linea.slice(0, i).trim();
      const v = linea.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (!salida[k]) salida[k] = v;
    }
  }
  return salida;
}

const env = leerEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (correr con --env-file=.env.local).');
  process.exit(2);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Funciones puras (las que deciden). Se prueban solas al arrancar: ver autotest().
// ---------------------------------------------------------------------------

/** Igual que el formulario: sin espacios alrededor y sin arrobas adelante. */
function limpiar(h) {
  return (h || '').trim().replace(/^@+/, '');
}

/** Lo que hacía el bug: borrar las "s" MINÚSCULAS (las mayúsculas no las tocaba). */
function sinEses(h) {
  return limpiar(h).replace(/s+/g, '');
}

/** El usuario que venía en el link original, o null. Mismos nombres que acepta el formulario. */
function igDelReferrer(referrer) {
  if (!referrer) return null;
  try {
    const q = new URL(referrer).searchParams;
    const crudo = q.get('ig') || q.get('instagram') || q.get('handle') || '';
    const v = limpiar(crudo);
    return v || null;
  } catch {
    return null;
  }
}

/** Teléfono a solo dígitos; se compara por los últimos 10 (sin prefijo de país ni el 9 de celular). */
function telClave(t) {
  const d = (t || '').replace(/[^0-9]/g, '');
  return d.length >= 8 ? d.slice(-10) : null;
}

/** Nombre sin tildes ni mayúsculas, para la pista por nombre. */
function nombreClave(n) {
  return (n || '')
    .normalize('NFD')
    .replace(/[^A-Za-z ]/g, '')
    .toLowerCase()
    .replace(/ +/g, ' ')
    .trim();
}

/**
 * Por qué un usuario escrito a mano no parece un usuario de Instagram, o null
 * si parece normal. No tiene que ver con el bug: es gente que puso el mail,
 * "si" o su nombre de pila. Igual le sirve al setter saberlo.
 */
function motivoSospechoso(guardado, nombre) {
  const g = limpiar(guardado);
  if (!g) return 'no dejó usuario de Instagram';
  if (!HANDLE_VALIDO.test(g)) return 'tiene caracteres que Instagram no permite (parece un mail u otra cosa)';
  if (/(gmail|hotmail|outlook|yahoo|icloud|live)[.]?com$/i.test(g) || /[.]com$/i.test(g)) return 'parece un mail sin la arroba';
  if (g.length < 4) return 'demasiado corto para ser un usuario real';
  const primerNombre = nombreClave(nombre).split(' ')[0];
  if (primerNombre && g.toLowerCase() === primerNombre) return 'es el nombre de pila, no un usuario';
  return null;
}

/**
 * Decide qué hacer con una fila. `fuentes` es una lista de { fuente, valor }
 * con lo que dijo cada fuente disponible (valor ya limpio).
 *
 * Devuelve { accion, candidato, fuente, motivo }.
 *   accion: 'CORREGIR' | 'SIN_CAMBIOS' | 'REVISAR'
 */
function decidir(guardadoCrudo, fuentes, nombre) {
  const guardado = limpiar(guardadoCrudo);
  const vinoPorLink = fuentes.some((f) => f.fuente === 'referrer');

  const candidatos = []; // dicen algo distinto y cumplen la regla (a)
  const confirman = []; // dicen lo mismo que la base
  const discrepan = []; // dicen otra cosa que no sale de sacarle las "s"

  for (const f of fuentes) {
    if (f.valor === guardado) {
      // Calendly repitiendo lo guardado no confirma nada durante el bug: el `a4`
      // se armó con el mismo valor roto. No suma ni resta.
      if (f.fuente !== 'calendly') confirman.push(f);
    } else if (guardado && HANDLE_VALIDO.test(f.valor) && sinEses(f.valor) === guardado) {
      candidatos.push(f);
    } else {
      discrepan.push(f);
    }
  }

  const distintos = [...new Set(candidatos.map((c) => c.valor))];
  const nombresFuentes = (l) => [...new Set(l.map((x) => x.fuente))].join('+');

  if (distintos.length > 1) {
    return {
      accion: 'REVISAR',
      candidato: distintos.join(' / '),
      fuente: nombresFuentes(candidatos),
      motivo: 'las fuentes proponen usuarios distintos',
    };
  }
  if (distintos.length === 1) {
    if (discrepan.length > 0 || confirman.length > 0) {
      const otras = [...discrepan, ...confirman].map((d) => `${d.fuente}: ${d.valor}`).join('; ');
      return {
        accion: 'REVISAR',
        candidato: distintos[0],
        fuente: nombresFuentes(candidatos),
        motivo: `otra fuente no coincide (${otras})`,
      };
    }
    return { accion: 'CORREGIR', candidato: distintos[0], fuente: nombresFuentes(candidatos), motivo: '' };
  }

  // Sin candidato que cumpla la regla.
  if (discrepan.length > 0) {
    // No es el bug (no hay "s" que lo explique): la misma persona dejó dos
    // usuarios distintos en dos lugares. No se toca nada; el setter prueba los dos.
    return {
      accion: 'REVISAR',
      candidato: discrepan.map((d) => d.valor).join(' / '),
      fuente: nombresFuentes(discrepan),
      motivo:
        confirman.length > 0
          ? `${nombresFuentes(confirman)} confirma lo guardado, pero en ${nombresFuentes(discrepan)} la misma persona puso otro usuario: probar los dos`
          : 'una fuente dice otro usuario y no se explica por las "s" que borró el bug',
    };
  }
  // Sin nada que corregir igual se mira si lo guardado tiene pinta de usuario.
  // Vale también para lo que vino por link: ese usuario lo escribió la persona
  // en el quiz del luchador, y ahí también hay quien pone "asd" o su nombre.
  const sospecha = motivoSospechoso(guardado, nombre);
  const origen = confirman.length > 0 ? nombresFuentes(confirman) : vinoPorLink ? 'referrer' : 'escrito a mano';
  if (sospecha) return { accion: 'REVISAR', candidato: '', fuente: origen, motivo: sospecha };
  if (confirman.length > 0) {
    return { accion: 'SIN_CAMBIOS', candidato: '', fuente: origen, motivo: 'la fuente confirma lo guardado' };
  }
  return {
    accion: 'SIN_CAMBIOS',
    candidato: '',
    fuente: 'escrito a mano',
    motivo: 'lo escribió la persona; el bug solo afectaba al usuario que venía en el link',
  };
}

/**
 * Autoprueba de las funciones que deciden. Corre siempre, antes de tocar nada:
 * este archivo ya nació de un bug por una barra invertida perdida, así que si
 * al copiarlo o editarlo se rompe una expresión regular, tiene que frenar acá y
 * no "corregir" usuarios con una regla rota.
 */
function autotest() {
  const ok = (cond, msg) => {
    if (!cond) {
      console.error(`AUTOTEST FALLÓ: ${msg}. No se hace nada.`);
      process.exit(3);
    }
  };
  ok(sinEses('@shrouded_in_wolves') === 'hrouded_in_wolve', 'sinEses saca las s minúsculas');
  ok(sinEses('Stevie_S') === 'Stevie_S', 'sinEses no toca la S mayúscula');
  ok(sinEses('a b') === 'a b', 'sinEses no saca espacios (eso era lo que DEBÍA hacer el original, no lo que hacía)');
  ok(igDelReferrer('https://x.com/consultoria-gratuita?ig=%40oscar_expos') === 'oscar_expos', 'igDelReferrer decodifica y saca la arroba');
  ok(igDelReferrer('https://x.com/consultoria-gratuita') === null, 'igDelReferrer sin parámetro');
  ok(igDelReferrer(null) === null, 'igDelReferrer con null');
  ok(telClave('+54 9 11 2345-6789') === '1123456789', 'telClave últimos 10 dígitos');
  ok(HANDLE_VALIDO.test('a.b_c9') && !HANDLE_VALIDO.test('a b') && !HANDLE_VALIDO.test('x@gmail.com'), 'HANDLE_VALIDO');

  let d = decidir('ocar_expo', [{ fuente: 'referrer', valor: 'oscar_expos' }], null);
  ok(d.accion === 'CORREGIR' && d.candidato === 'oscar_expos', 'caso típico se corrige');
  d = decidir('ocar_expo', [{ fuente: 'referrer', valor: 'oscar_expos' }, { fuente: 'calendly', valor: 'ocar_expo' }], null);
  ok(d.accion === 'CORREGIR', 'Calendly repitiendo el valor roto no frena la corrección');
  d = decidir('ocar_expo', [{ fuente: 'referrer', valor: 'oscar_expos' }, { fuente: 'quiz_luchador', valor: 'oscarexpo' }], null);
  ok(d.accion === 'REVISAR', 'si otra fuente dice otra cosa, no se corrige');
  d = decidir('ocar_expo', [{ fuente: 'referrer', valor: 'oscar_expos' }, { fuente: 'calendly', valor: 'oscar_expo' }], null);
  ok(d.accion === 'REVISAR', 'dos candidatos válidos distintos van a revisión');
  d = decidir('pepe', [{ fuente: 'referrer', valor: 'pepe' }], null);
  ok(d.accion === 'SIN_CAMBIOS', 'link igual a lo guardado: sin cambios');
  d = decidir('pepe', [{ fuente: 'referrer', valor: 'otro_usuario' }], null);
  ok(d.accion === 'REVISAR', 'link con otro usuario que no sale de las s: revisión');
  d = decidir('santiagoidiart', [], 'Santiago Idiart');
  ok(d.accion === 'SIN_CAMBIOS', 'escrito a mano y con pinta de usuario: sin cambios');
  d = decidir('gonzalo', [], 'Gonzalo Pérez');
  ok(d.accion === 'REVISAR', 'nombre de pila como usuario: revisión');
  d = decidir('alguien@gmail.com', [], null);
  ok(d.accion === 'REVISAR', 'mail como usuario: revisión');
  d = decidir(null, [], null);
  ok(d.accion === 'REVISAR', 'sin usuario: revisión');
  d = decidir('asd', [{ fuente: 'referrer', valor: 'asd' }], null);
  ok(d.accion === 'REVISAR', 'basura confirmada por el link sigue siendo basura: revisión');
  d = decidir('den.bjj', [{ fuente: 'referrer', valor: 'den.bjj' }, { fuente: 'quiz_luchador', valor: 'Denbjj' }], null);
  ok(d.accion === 'REVISAR' && d.candidato === 'Denbjj', 'dos usuarios distintos de la misma persona: revisión, sin corregir');
}

// ---------------------------------------------------------------------------
// Fuente Calendly (opcional)
// ---------------------------------------------------------------------------

const CALENDLY_API = 'https://api.calendly.com';

async function calendlyGet(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${env.CALENDLY_TOKEN}` } });
  if (!res.ok) throw new Error(`Calendly ${res.status}`);
  return res.json();
}

/**
 * Usuarios de Instagram que quedaron en la pregunta "REF" de las consultorías
 * de este mail. Devuelve la lista de valores distintos (puede ser vacía).
 * Misma lectura que `instagramDe` en src/lib/calendly.ts; se repite acá porque
 * aquel módulo es `server-only` y no se puede importar desde un script.
 */
async function handlesDeCalendly(org, email) {
  const qs = new URLSearchParams({ organization: org, invitee_email: email.trim().toLowerCase(), count: '10' });
  const { collection } = await calendlyGet(`${CALENDLY_API}/scheduled_events?${qs}`);
  const vistos = new Set();
  for (const ev of collection || []) {
    const id = ev.uri.split('/').pop();
    const inv = await calendlyGet(`${CALENDLY_API}/scheduled_events/${encodeURIComponent(id)}/invitees?count=5`);
    for (const p of inv.collection || []) {
      const qa = (p.questions_and_answers || []).find((q) => /^ *ref/i.test(q.question));
      const v = limpiar(qa?.answer);
      if (v && HANDLE_VALIDO.test(v)) vistos.add(v);
    }
  }
  return [...vistos];
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

function imprimirTabla(filas) {
  const cols = ['session_id', 'guardado', 'candidato', 'fuente', 'acción'];
  const datos = filas.map((f) => [
    f.session_id.slice(0, 8),
    f.guardado ?? '(vacío)',
    f.candidato || '-',
    f.fuente || '-',
    f.accion === 'CORREGIR' ? 'CORREGIR' : f.accion === 'REVISAR' ? `REVISAR: ${f.motivo}` : 'sin cambios',
  ]);
  const anchos = cols.map((c, i) => Math.max(c.length, ...datos.map((d) => String(d[i]).length)));
  const linea = (d) => d.map((v, i) => String(v).padEnd(anchos[i])).join(' | ');
  console.log(linea(cols));
  console.log(anchos.map((a) => '-'.repeat(a)).join('-|-'));
  for (const d of datos) console.log(linea(d));
}

function aCsv(filas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ['session_id', 'fecha', 'guardado', 'candidato', 'fuente', 'motivo', 'pista_por_nombre', 'agendo', 'nombre', 'telefono', 'email'];
  const lineas = [cab.join(',')];
  for (const f of filas) {
    lineas.push(
      [f.session_id, f.created_at, f.guardado, f.candidato, f.fuente, f.motivo, f.pista, f.booked ? 'si' : 'no', f.nombre, f.telefono, f.email]
        .map(esc)
        .join(','),
    );
  }
  // BOM para que Excel abra las tildes bien.
  return '﻿' + lineas.join('\r\n') + '\r\n';
}

function sello() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function asegurarDirBackups() {
  if (!existsSync(DIR_BACKUPS)) mkdirSync(DIR_BACKUPS, { recursive: true });
}

async function filasDelRango(columnas) {
  const { data, error } = await sb
    .from('lead_quiz_responses')
    .select(columnas)
    .gte('created_at', DESDE)
    .lt('created_at', HASTA)
    .order('created_at');
  if (error) throw new Error(`No pude leer lead_quiz_responses: ${error.message}`);
  return data || [];
}

const conEse = (filas) => filas.filter((f) => /s/.test(f.instagram || '')).length;

// ---------------------------------------------------------------------------
// Modo restaurar
// ---------------------------------------------------------------------------

async function restaurar() {
  const backup = JSON.parse(readFileSync(ARCHIVO_RESTAURAR, 'utf8'));
  let cambios = backup.cambios || [];
  console.log(`Backup del ${backup.generado}: ${cambios.length} correcciones para deshacer.`);
  console.log(APLICAR ? 'MODO: restaurar de verdad.' : 'MODO: dry-run de la restauración (agregar --aplicar para hacerla).');
  if (SOLO) {
    // Mismo criterio que al aplicar. Sin esto, "--restaurar ... --solo a7f1eb7e"
    // deshacía TODAS las correcciones cuando el que lo corre quiso deshacer una.
    const enBackup = (p) => (c) => String(c.session_id || '').toLowerCase().startsWith(p);
    const sinFila = SOLO.filter((p) => !cambios.some(enBackup(p)));
    if (sinFila.length > 0) console.log(`Aviso: estos ids de --solo no están en el backup: ${sinFila.join(', ')}.`);
    cambios = cambios.filter((c) => SOLO.some((p) => enBackup(p)(c)));
    console.log(`--solo: quedan ${cambios.length} correcciones para deshacer.`);
  }
  let hechos = 0;
  for (const c of cambios) {
    const { data: actual, error } = await sb.from('lead_quiz_responses').select('id, instagram').eq('id', c.id).maybeSingle();
    if (error || !actual) {
      console.log(`  ${c.session_id.slice(0, 8)}: no encontré la fila, la salteo.`);
      continue;
    }
    if (actual.instagram !== c.nuevo) {
      // Alguien lo editó después de la corrección: esa edición manda, no se pisa.
      console.log(`  ${c.session_id.slice(0, 8)}: hoy dice "${actual.instagram}", no "${c.nuevo}". Lo cambiaron a mano; no lo toco.`);
      continue;
    }
    console.log(`  ${c.session_id.slice(0, 8)}: ${c.nuevo} -> ${c.original}`);
    if (!APLICAR) continue;
    const { data: upd, error: eUpd } = await sb
      .from('lead_quiz_responses')
      .update({ instagram: c.original })
      .eq('id', c.id)
      .eq('instagram', c.nuevo)
      .select('id');
    if (eUpd || !upd || upd.length !== 1) {
      console.log(`    ERROR al restaurar: ${eUpd?.message || 'no se actualizó ninguna fila'}`);
      continue;
    }
    hechos++;
    // No se borra la nota anterior: se agrega otra, así el historial cuenta lo que pasó.
    const { error: eNota } = await sb.from('lead_contacts').insert({
      lead_id: c.id,
      canal: 'otro',
      direccion: 'saliente',
      nota: `Handle restaurado: ${c.nuevo} → ${c.original} (se deshizo la corrección automática)`,
    });
    if (eNota) console.log(`    Aviso: restauré el usuario pero no pude dejar la nota (${eNota.message}).`);
  }
  console.log(APLICAR ? `Restauradas: ${hechos} de ${cambios.length}.` : 'Nada se escribió.');
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function main() {
  autotest();

  if (ARCHIVO_RESTAURAR) return restaurar();

  console.log(APLICAR ? 'MODO: --aplicar (escribe en la base).' : 'MODO: dry-run. No se escribe nada en la base.');
  console.log(`Rango: ${DESDE} a ${HASTA} (exclusivo).`);

  const leads = await filasDelRango('id, session_id, instagram, referrer, email, telefono, nombre, booked, created_at');
  console.log(`Filas en el rango: ${leads.length}. Con alguna "s" en el usuario: ${conEse(leads)}.`);

  // Quiz del luchador completo (son pocas filas). Solo lectura.
  const { data: luchador, error: eLuch } = await sb.from('match_quiz_responses').select('instagram, whatsapp, nombre');
  if (eLuch) console.log(`Aviso: no pude leer el quiz del luchador (${eLuch.message}). Sigo sin esa fuente.`);
  const porTel = new Map();
  const porNombre = new Map();
  for (const m of luchador || []) {
    const ig = limpiar(m.instagram);
    if (!ig) continue;
    const t = telClave(m.whatsapp);
    if (t) porTel.set(t, [...(porTel.get(t) || []), ig]);
    const n = nombreClave(m.nombre);
    if (n.includes(' ')) porNombre.set(n, [...(porNombre.get(n) || []), ig]);
  }

  // Calendly: opcional.
  let orgCalendly = null;
  if (env.CALENDLY_TOKEN) {
    try {
      const me = await calendlyGet(`${CALENDLY_API}/users/me`);
      orgCalendly = me.resource.current_organization;
      console.log('Fuente Calendly: activa.');
    } catch (e) {
      console.log(`Fuente Calendly: el token no anduvo (${e.message}). Se saltea.`);
    }
  } else {
    console.log('Fuente Calendly: SALTEADA (no hay CALENDLY_TOKEN). Las decisiones salen del link original y del quiz del luchador.');
  }

  const resultado = [];
  for (const l of leads) {
    const fuentes = [];
    const ig = igDelReferrer(l.referrer);
    if (ig) fuentes.push({ fuente: 'referrer', valor: ig });

    const t = telClave(l.telefono);
    for (const v of new Set((t && porTel.get(t)) || [])) fuentes.push({ fuente: 'quiz_luchador', valor: v });

    if (orgCalendly && l.email) {
      try {
        for (const v of await handlesDeCalendly(orgCalendly, l.email)) fuentes.push({ fuente: 'calendly', valor: v });
      } catch (e) {
        // Si Calendly falla para uno, esa fila se queda sin esa fuente; no se cae todo.
        console.log(`  Aviso: Calendly falló para ${l.session_id.slice(0, 8)} (${e.message}).`);
      }
    }

    const d = decidir(l.instagram, fuentes, l.nombre);
    const n = nombreClave(l.nombre);
    const pista = n.includes(' ') && porNombre.has(n) ? [...new Set(porNombre.get(n))].join(' / ') : '';
    resultado.push({ ...l, guardado: l.instagram, ...d, pista });
  }

  console.log('');
  imprimirTabla(resultado);

  let aCorregir = resultado.filter((r) => r.accion === 'CORREGIR');
  const aRevisar = resultado.filter((r) => r.accion === 'REVISAR');
  const sinCambios = resultado.filter((r) => r.accion === 'SIN_CAMBIOS');
  const confirmadosPorLink = sinCambios.filter((r) => r.fuente !== 'escrito a mano').length;

  console.log('');
  console.log(`CORREGIR: ${aCorregir.length}`);
  console.log(`Sin cambios: ${sinCambios.length} (${confirmadosPorLink} confirmados por una fuente, ${sinCambios.length - confirmadosPorLink} escritos a mano: el bug no los tocó)`);
  console.log(`REVISAR a mano: ${aRevisar.length}`);

  // El CSV lleva nombre y teléfono para que el setter pueda ubicar a la persona
  // por otro lado. Por eso va a scripts/backups/, que git ignora: los datos de
  // personas no entran al repo.
  asegurarDirBackups();
  const rutaCsv = new URL('handles-a-revisar.csv', DIR_BACKUPS);
  writeFileSync(rutaCsv, aCsv(aRevisar), 'utf8');
  console.log(`CSV para el setter: scripts/backups/handles-a-revisar.csv (${aRevisar.length} filas).`);

  if (!APLICAR) {
    console.log('');
    console.log('Dry-run terminado. Nada se escribió en la base. Para aplicar: agregar --aplicar (después de aprobar este listado).');
    return;
  }

  // ------------------------- A partir de acá se escribe -------------------------

  if (SOLO) {
    // Un id mal tipeado no puede pasar en silencio: el que lo pidió creería que se corrigió.
    const sinFila = SOLO.filter((p) => !aCorregir.some((r) => r.session_id.toLowerCase().startsWith(p)));
    if (sinFila.length > 0) console.log(`Aviso: estos ids de --solo no están entre los CORREGIR: ${sinFila.join(', ')}.`);
    aCorregir = aCorregir.filter((r) => SOLO.some((p) => r.session_id.toLowerCase().startsWith(p)));
    console.log(`--solo: quedan ${aCorregir.length} filas para corregir.`);
  }
  if (aCorregir.length === 0) {
    console.log('No hay nada para corregir.');
    return;
  }

  // Cinturón y tirantes: nada fuera del rango, aunque alguien toque el select de arriba.
  for (const r of aCorregir) {
    const f = new Date(r.created_at).getTime();
    if (!(f >= new Date(DESDE).getTime() && f < new Date(HASTA).getTime())) {
      console.error(`La fila ${r.session_id.slice(0, 8)} está fuera del rango. Freno sin escribir nada.`);
      process.exit(4);
    }
  }

  // 1) Backup ANTES de escribir: las filas completas del rango y la lista de cambios.
  const antes = await filasDelRango('*');
  const cambios = aCorregir.map((r) => ({ id: r.id, session_id: r.session_id, original: r.guardado, nuevo: r.candidato, fuente: r.fuente }));
  const rutaBackup = new URL(`handles-backup-${sello()}.json`, DIR_BACKUPS);
  writeFileSync(
    rutaBackup,
    JSON.stringify({ generado: new Date().toISOString(), rango: { desde: DESDE, hasta: HASTA }, con_s_antes: conEse(antes), cambios, filas_rango: antes }, null, 2),
    'utf8',
  );
  console.log(`Backup escrito: scripts/backups/${rutaBackup.pathname.split('/').pop()}`);

  // 2) Updates, de a uno y con candado: solo si la fila sigue diciendo lo que
  //    vimos. Si el setter la arregló a mano mientras tanto, no se le pisa.
  let hechos = 0;
  for (const c of cambios) {
    const { data: upd, error } = await sb
      .from('lead_quiz_responses')
      .update({ instagram: c.nuevo })
      .eq('id', c.id)
      .eq('instagram', c.original)
      .gte('created_at', DESDE)
      .lt('created_at', HASTA)
      .select('id');
    if (error || !upd || upd.length !== 1) {
      console.log(`  ${c.session_id.slice(0, 8)}: NO se actualizó (${error?.message || 'la fila cambió desde el listado'}).`);
      continue;
    }
    hechos++;
    console.log(`  ${c.session_id.slice(0, 8)}: ${c.original} -> ${c.nuevo}`);
    const { error: eNota } = await sb.from('lead_contacts').insert({
      lead_id: c.id,
      canal: 'otro',
      direccion: 'saliente',
      nota: `Handle corregido automáticamente: ${c.original} → ${c.nuevo} (fuente: ${c.fuente})`,
    });
    if (eNota) console.log(`    Aviso: corregí el usuario pero no pude dejar la nota en el lead (${eNota.message}).`);
  }

  // 3) Verificación contra el backup: fuera de los cambios pedidos, nada más se movió.
  const despues = await filasDelRango('*');
  const idsCambiados = new Set(cambios.map((c) => c.id));
  const porId = new Map(antes.map((f) => [f.id, f]));
  let raros = 0;
  for (const f of despues) {
    const a = porId.get(f.id);
    if (!a) continue; // fila nueva en el rango: imposible por fecha, pero no es nuestra.
    const campos = Object.keys(f).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(a[k]));
    const esperados = idsCambiados.has(f.id) ? ['instagram'] : [];
    const extra = campos.filter((k) => !esperados.includes(k));
    if (extra.length > 0) {
      // Puede ser legítimo (un cron marcó un aviso, el setter movió la etapa). Se avisa para mirarlo.
      raros++;
      console.log(`  Ojo: ${f.session_id.slice(0, 8)} cambió también en [${extra.join(', ')}] (no fue este script).`);
    }
  }
  console.log('');
  console.log(`Corregidas: ${hechos} de ${cambios.length}.`);
  console.log(`Usuarios con alguna "s" en el rango: antes ${conEse(antes)}, ahora ${conEse(despues)}.`);
  console.log(raros === 0 ? 'Verificación: ninguna otra fila ni campo cambió.' : `Verificación: ${raros} filas con cambios ajenos a este script (ver arriba).`);
  console.log('Para deshacer: node --env-file=.env.local scripts/recuperar-handles.mjs --restaurar <ese backup> --aplicar');
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

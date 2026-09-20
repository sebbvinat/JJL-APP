// diagnostico-mes2 — WP-08, paso 1. SOLO LECTURA: no escribe en la base ni en disco.
//
// Por qué existe: el "Mes 2" (semanas 5 a 8) se reordenó en mayo (primero los
// Escapes de 100KG, después Armbar y Kimura) pero el module_id y los lesson_id
// NO cambiaron de nombre: `mod-5` pasó de ser "100KG + Kimura" a ser
// "Escape 100KG I", y `<planilla>-s7-0` pasó de ser "Escape 100 kilos" a ser
// "Finalización Armbar". Antes de decidir si se alinea a alguien hay que saber,
// con números, (1) quién sigue con el orden viejo, (2) qué progreso quedaría
// sin mapeo por título y (3) qué módulos no tienen fila en user_access.
// Ojo: hubo TRES órdenes, no dos (ver ORDEN_VIEJO y ORDEN_INTERMEDIO más abajo).
//
// Cómo se corre (desde la raíz del repo):
//     npx tsx scripts/diagnostico-mes2.mjs              <- recomendado
//     node scripts/diagnostico-mes2.mjs                 <- también anda con Node >= 23.6
//   Opciones:
//     --detalle    muestra la línea de tiempo del progreso de Mes 2 de cada cuenta afectada
//     --ids        muestra los primeros 8 caracteres del user_id (para ubicar la cuenta en /admin)
//     --estricto   termina con código 1 si queda algo por alinear (para usarlo como criterio de aceptación)
//
// Por qué importa la planilla del código en vez de copiarla: si la copiáramos,
// el día que cambie `src/lib/planillas.ts` este diagnóstico mentiría. Se importa
// el .ts directo (y `normTitle` de admin-videos.ts, la misma función que usa el
// backend para comparar títulos). Con `tsx` eso anda solo. Con Node pelado
// también, porque Node moderno saca los tipos, pero hay dos cosas que Node no
// sabe y que se resuelven acá abajo:
//   - el alias `@/` de tsconfig (planillas.ts importa '@/lib/mock-data');
//   - `require()` dentro de un módulo ES (la versión anterior de planillas.ts lo
//     usaba para mock-data; se deja el parche porque ese archivo está cambiando).
//
// Privacidad: no imprime nombres ni emails. Las cuentas salen como "cuenta #N".
// Credenciales: las lee de las variables de entorno o de .env.local; nunca las imprime.
import { existsSync, readFileSync } from 'node:fs';
import * as moduloDeNode from 'node:module';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

if (typeof moduloDeNode.registerHooks === 'function') {
  // Traduce '@/algo' a src/algo(.ts|.tsx|/index.ts). Solo toca ese alias; el
  // resto de los imports sigue su camino normal (incluido tsx, si está).
  const raizSrc = new URL('../src/', import.meta.url);
  moduloDeNode.registerHooks({
    resolve(especificador, contexto, siguiente) {
      if (especificador.startsWith('@/')) {
        const base = especificador.slice(2);
        for (const candidato of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base]) {
          const url = new URL(candidato, raizSrc);
          if (existsSync(fileURLToPath(url))) return siguiente(url.href, contexto);
        }
      }
      return siguiente(especificador, contexto);
    },
  });
}

// Según quién cargue el .ts (Node o tsx) los exports llegan sueltos o adentro de `default`.
const exportsDe = (mod, nombre) => (nombre in mod ? mod : mod.default ?? mod);
const moduloMock = await import('../src/lib/mock-data.ts');
const datosMock = exportsDe(moduloMock, 'MOCK_LESSONS');
if (typeof globalThis.require === 'undefined') {
  globalThis.require = (id) => {
    if (id === '@/lib/mock-data') return datosMock;
    throw new Error(`diagnostico-mes2: require("${id}") no está contemplado`);
  };
}
const moduloPlanillas = await import('../src/lib/planillas.ts');
const { getPlanillaForSave, PLANILLAS } = exportsDe(moduloPlanillas, 'getPlanillaForSave');
const moduloVideos = await import('../src/lib/admin-videos.ts');
const { normTitle } = exportsDe(moduloVideos, 'normTitle');
if (typeof getPlanillaForSave !== 'function' || !Array.isArray(PLANILLAS) || typeof normTitle !== 'function') {
  throw new Error('No se pudieron importar getPlanillaForSave / PLANILLAS / normTitle desde src/lib');
}

const ARGS = new Set(process.argv.slice(2));
const CON_DETALLE = ARGS.has('--detalle');
const CON_IDS = ARGS.has('--ids');
const ESTRICTO = ARGS.has('--estricto');

const SEMANAS_MES2 = [5, 6, 7, 8];
const IDS_PLANILLA = PLANILLAS.map((p) => p.id);

// Cómo eran los lesson_id del Mes 2 con el ORDEN VIEJO (sin el prefijo de la
// planilla). Hace falta como dato histórico porque el sync de planillas pisó el
// course_data de casi todos los alumnos SIN tocar user_progress: para saber qué
// lección marcó en su momento un alumno con `-s7-0` hay que saber qué título
// tenía ese id entonces. Sale de los backups de mayo (scripts/mes2-backup-*.json,
// scripts/kimura-armbar-backup-*.json) y se contrasta más abajo contra las
// cuentas que TODAVÍA tienen el orden viejo en la base.
//
// `semana` es la semana en la que quedó el módulo al final. `antes` dice en qué
// semana estuvo HASTA cada momento, porque a estas cuentas se les movió la
// semana por script sin cambiarles los ids (los momentos son la hora de cada
// backup, que se sacó un minuto antes de escribir):
//   19/5 -> los escapes pasan a semanas 5-6 y las finalizaciones a 7-8;
//   25/5 -> kimura-armbar-swap: Armbar a la 7, Kimura a la 8;
//   1/6  -> "Concepto de 100 KG" (s5-0) pasa del módulo de Kimura al de Armbar.
// Solo lo usa la estimación por secuencia: una marca del 17/5 con `s7-0` se hizo
// cuando ese módulo era la semana 7, no la 5, y leerla como 5 tuerce el corte.
const T_REORDEN = '2026-05-19T17:08:12Z';
const T_SWAP = '2026-05-25T15:59:15Z';
const T_CONCEPTO = '2026-06-01T17:47:45Z';
const ORDEN_VIEJO = [
  { module_id: 'mod-7', semana: 5, antes: [[T_REORDEN, 7]], titulo: 'Escape 100KG I', lecciones: [
    ['s7-conceptos', 'Conceptos de 100kg'], ['s7-0', 'Escape 100 kilos'], ['s7-1', 'Drill 1: Escape de 100kg'],
    ['s7-2', 'Drill 2: Escape + Combinación Guardia cerrada'], ['s7-3', 'Específico de guardia cerrada'], ['s7-4', 'Reflexión semanal'] ] },
  { module_id: 'mod-8', semana: 6, antes: [[T_REORDEN, 8]], titulo: 'Escape 100KG II', lecciones: [
    ['s8-0', 'Escape de 100KG variante 2'], ['s8-1', 'Drill 1: 100 KG variante 2'],
    ['s8-2', 'Drill 2: Drill combinación escape + guardia cerrada'], ['s8-3', 'Específico de toreos'], ['s8-4', 'Reflexión semanal'] ] },
  { module_id: 'mod-6', semana: 7, antes: [[T_REORDEN, 6], [T_SWAP, 8]], titulo: 'Armbar + Guardia Cerrada', lecciones: [
    // s5-0 vivió en el módulo de Kimura hasta el 1/6: lleva su propia historia de semanas.
    ['s5-0', 'Concepto de 100 KG', [[T_REORDEN, 5], [T_SWAP, 7], [T_CONCEPTO, 8]]], ['s6-0', 'Finalización Armbar'], ['s6-1', 'Drill 1: Armbar'],
    ['s6-2', 'Drill 2: Combinación toreos + armbar'], ['s6-3', 'Específico de 100KG'], ['s6-4', 'Reflexión semanal'] ] },
  { module_id: 'mod-5', semana: 8, antes: [[T_REORDEN, 5], [T_SWAP, 7]], titulo: '100KG + Kimura', lecciones: [
    ['s5-1', 'Finalización Kimura'], ['s5-2', 'Drill 1: Kimura'], ['s5-3', 'Drill 2: Combinación toreos + Kimura'],
    ['s5-4', 'Observaciones finales toreos'], ['s5-5', 'Específico de 100KG'], ['s5-6', 'Reflexión semanal'] ] },
];
// Hubo un TERCER orden, el "intermedio": entre el 11/5 (commit b8eea27) y el
// 25/5 (commit 82b75bc) la planilla ya tenía los escapes primero, pero con
// mod-7 = "100KG + Kimura" (s7-*) y mod-8 = "Armbar + Guardia Cerrada" (s8-*),
// al revés que hoy. A las cuentas dadas de alta en esa ventana el swap del 25/5
// solo les cambió la semana (por título), y después el sync les pisó
// course_data: `s7-*` dejó de ser Kimura para ser Armbar y `s8-*` al revés.
// mod-7 y mod-8 salen de `git show 82b75bc^:src/lib/planillas.ts`; mod-5 y mod-6
// (iguales a hoy) se contrastan más abajo contra el backup del 25/5.
const ORDEN_INTERMEDIO = [
  { module_id: 'mod-5', semana: 5, titulo: 'Escape 100KG I', lecciones: [
    ['s5-0', 'Conceptos de 100kg'], ['s5-1', 'Escape 100 kilos'], ['s5-2', 'Drill 1: Escape de 100kg'],
    ['s5-3', 'Drill 2: Escape + Combinación Guardia cerrada'], ['s5-4', 'Específico de guardia cerrada'], ['s5-5', 'Reflexión semanal'] ] },
  { module_id: 'mod-6', semana: 6, titulo: 'Escape 100KG II', lecciones: [
    ['s6-0', 'Escape de 100KG variante 2'], ['s6-1', 'Drill 1: 100 KG variante 2'],
    ['s6-2', 'Drill 2: Drill combinación escape + guardia cerrada'], ['s6-3', 'Específico de toreos'], ['s6-4', 'Reflexión semanal'] ] },
  { module_id: 'mod-8', semana: 7, antes: [[T_SWAP, 8]], titulo: 'Armbar + Guardia Cerrada', lecciones: [
    ['s8-0', 'Finalización Armbar'], ['s8-1', 'Drill 1: Armbar'], ['s8-2', 'Drill 2: Combinación toreos + armbar'],
    ['s8-3', 'Específico de 100KG'], ['s8-4', 'Reflexión semanal'] ] },
  { module_id: 'mod-7', semana: 8, antes: [[T_SWAP, 7]], titulo: '100KG + Kimura', lecciones: [
    ['s7-0', 'Concepto de 100 KG'], ['s7-1', 'Finalización Kimura'], ['s7-2', 'Drill 1: Kimura'],
    ['s7-3', 'Drill 2: Combinación toreos + Kimura'], ['s7-4', 'Observaciones finales toreos'],
    ['s7-5', 'Específico de 100KG'], ['s7-6', 'Reflexión semanal'] ] },
];
// Lista de cuentas que tenían el orden viejo el 19/5 (solo se usan los user_id).
const RESPALDO_MAYO = new URL('./mes2-backup-2026-05-19T17-08-12-101Z.json', import.meta.url);
// Backup de mod-5 y mod-6 de TODAS las cuentas el 25/5: las que ahí ya tenían
// "Escape 100KG I" en mod-5 son las que recibieron el orden intermedio.
const RESPALDO_SWAP = new URL('./kimura-armbar-backup-2026-05-25T15-59-15-529Z.json', import.meta.url);

/** Arma, para una tabla histórica, qué lección era cada id y en qué semana estaba en cada momento. */
function armarHistorico(orden) {
  const porSufijo = new Map();
  for (const m of orden) {
    for (const [suf, t, antesPropio] of m.lecciones) {
      porSufijo.set(suf, { leccion: t, modulo: m.titulo, semana: m.semana, antes: antesPropio ?? m.antes ?? [] });
    }
  }
  return {
    orden,
    porSufijo,
    semanaEn(sufijo, t) {
      const dato = porSufijo.get(sufijo);
      if (!dato) return undefined;
      for (const [hasta, semana] of dato.antes) if (t < Date.parse(hasta)) return semana;
      return dato.semana;
    },
  };
}
const HIST_VIEJO = armarHistorico(ORDEN_VIEJO);
const HIST_INTERMEDIO = armarHistorico(ORDEN_INTERMEDIO);

// ---------------------------------------------------------------- utilidades

function leerEntorno() {
  // Primero el entorno (node --env-file=.env.local ...); si no, .env.local a mano,
  // igual que scripts/check-schema.mjs, para que también ande con `npx tsx` a secas.
  const faltan = (e) => !e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY;
  if (!faltan(process.env)) return process.env;
  const ruta = new URL('../.env.local', import.meta.url);
  if (!existsSync(ruta)) throw new Error('No hay variables de Supabase en el entorno ni archivo .env.local');
  const env = {};
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const l = linea.trim();
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    let valor = l.slice(i + 1).trim();
    if (valor.length >= 2 && (valor[0] === '"' || valor[0] === "'") && valor.endsWith(valor[0])) valor = valor.slice(1, -1);
    env[l.slice(0, i).trim()] = valor;
  }
  if (faltan(env)) throw new Error('.env.local no tiene NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return env;
}

const entorno = leerEntorno();
const sb = createClient(entorno.NEXT_PUBLIC_SUPABASE_URL, entorno.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// PostgREST corta en 1000 filas por pedido y course_data ya tiene más: sin
// paginar, el diagnóstico daría números de menos sin avisar. El orden por clave
// hace que las páginas no se pisen ni se salteen filas.
async function leerTodo(tabla, columnas, orden) {
  const filas = [];
  const PAGINA = 1000;
  for (let desde = 0; ; desde += PAGINA) {
    let consulta = sb.from(tabla).select(columnas).range(desde, desde + PAGINA - 1);
    for (const col of orden) consulta = consulta.order(col, { ascending: true });
    const { data, error } = await consulta;
    if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
    filas.push(...data);
    if (data.length < PAGINA) break;
  }
  return filas;
}

function agrupar(filas, clave) {
  const m = new Map();
  for (const f of filas) {
    const k = clave(f);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(f);
  }
  return m;
}

function contar(lista, clave) {
  const m = {};
  for (const x of lista) { const k = clave(x); m[k] = (m[k] || 0) + 1; }
  return m;
}

const titulo = (t) => console.log(`\n=== ${t} ===`);
const fecha = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : 'sin fecha');

/** "medios-s7-0" -> { prefijo: "medios", sufijo: "s7-0" }. Si no tiene prefijo de planilla, prefijo null. */
function partirId(lessonId) {
  const s = String(lessonId);
  for (const p of IDS_PLANILLA) {
    if (s.startsWith(`${p}-`)) return { prefijo: p, sufijo: s.slice(p.length + 1) };
  }
  return { prefijo: null, sufijo: s };
}

// ------------------------------------------------------------------ lectura

const [usuarios, courseData, progreso, accesos, overrides] = await Promise.all([
  leerTodo('users', 'id, rol, planilla_id', ['id']),
  leerTodo('course_data', 'user_id, module_id, semana_numero, titulo, lessons, updated_at', ['user_id', 'module_id']),
  leerTodo('user_progress', 'user_id, lesson_id, completado, completed_at', ['user_id', 'lesson_id']),
  leerTodo('user_access', 'user_id, module_id, is_unlocked', ['user_id', 'module_id']),
  leerTodo('lesson_video_overrides', 'module_id, lesson_key, titulo', ['module_id', 'lesson_key']),
]);

const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
const cursoPorCuenta = agrupar(courseData, (f) => f.user_id);
const progresoPorCuenta = agrupar(progreso, (f) => f.user_id);
const accesoPorCuenta = agrupar(accesos, (f) => f.user_id);

// Etiqueta anónima y estable dentro de una corrida (orden por user_id).
const etiquetas = new Map();
[...new Set([...cursoPorCuenta.keys(), ...progresoPorCuenta.keys()])].sort()
  .forEach((id, i) => etiquetas.set(id, `cuenta #${i + 1}`));
const rolDe = (id) => usuarioPorId.get(id)?.rol ?? 'sin fila en users';
function nombrar(id) {
  const u = usuarioPorId.get(id);
  const partes = [etiquetas.get(id) ?? 'cuenta s/n', `rol: ${rolDe(id)}`, `planilla: ${u?.planilla_id ?? 'ninguna'}`];
  if (CON_IDS) partes.push(`id: ${String(id).slice(0, 8)}`);
  return partes.join(', ');
}

// Planilla contra la que se compara cada cuenta. Si el usuario no tiene
// planilla_id (admins de prueba, cuentas borradas de `users`), se deduce del
// prefijo de sus lesson_id: las semanas 5-8 son iguales en las 4 planillas, lo
// único que cambia es ese prefijo.
const planillaCache = new Map();
function planillaGuardable(pid) {
  if (!planillaCache.has(pid)) planillaCache.set(pid, getPlanillaForSave(pid));
  return planillaCache.get(pid);
}
function planillaDeCuenta(id) {
  const declarada = usuarioPorId.get(id)?.planilla_id;
  if (declarada && planillaGuardable(declarada)) return { pid: declarada, deducida: false };
  const prefijos = {};
  for (const fila of cursoPorCuenta.get(id) || []) {
    for (const l of Array.isArray(fila.lessons) ? fila.lessons : []) {
      const { prefijo } = partirId(l?.id);
      if (prefijo) prefijos[prefijo] = (prefijos[prefijo] || 0) + 1;
    }
  }
  const mejor = Object.entries(prefijos).sort((a, b) => b[1] - a[1])[0];
  return { pid: mejor ? mejor[0] : 'livianos', deducida: true };
}

// Títulos que el sync escribiría de verdad: planilla + override de título del
// mismo módulo (misma regla que sync-planillas). Sin esto, un título cambiado
// desde /admin/videos aparecería como "desvío" cuando en realidad está bien.
const overridePorClave = new Map(overrides.map((o) => [`${o.module_id}::${o.lesson_key}`, o]));
function mes2Esperado(pid) {
  return planillaGuardable(pid)
    .filter((m) => SEMANAS_MES2.includes(m.semana_numero))
    .map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => {
        const ov = overridePorClave.get(`${m.module_id}::${normTitle(l.titulo)}`);
        return ov?.titulo != null ? { ...l, titulo: ov.titulo } : l;
      }),
    }));
}

/**
 * Propone el lesson_id nuevo para una lección identificada por título.
 * 1) mismo título de módulo + mismo título de lección (resuelve los títulos que
 *    se repiten en varias semanas: "Reflexión semanal", "Específico de 100KG");
 * 2) si no, el título de la lección tiene que ser ÚNICO dentro del Mes 2 (caso
 *    "Concepto de 100 KG", que cambió de módulo).
 * Si no hay match unívoco devuelve null: eso es lo que NO se debe reescribir.
 */
function mapearPorTitulo(pid, tituloModulo, tituloLeccion) {
  const mes2 = mes2Esperado(pid);
  const clave = normTitle(tituloLeccion);
  const enModulo = mes2.filter((m) => normTitle(m.titulo) === normTitle(tituloModulo))
    .flatMap((m) => m.lessons.filter((l) => normTitle(l.titulo) === clave).map((l) => ({ id: l.id, modulo: m })));
  if (enModulo.length === 1) return { id: enModulo[0].id, via: 'módulo + título' };
  const enMes = mes2.flatMap((m) => m.lessons.filter((l) => normTitle(l.titulo) === clave).map((l) => ({ id: l.id, modulo: m })));
  if (enMes.length === 1) return { id: enMes[0].id, via: 'título único en el Mes 2' };
  return { id: null, via: enMes.length === 0 ? 'ese título no existe en el Mes 2 nuevo' : `título ambiguo (${enMes.length} candidatos)` };
}

// ---------------------------------------------------------------- 0. panorama

titulo('0. Panorama');
console.log(`usuarios: ${usuarios.length} | course_data: ${courseData.length} filas en ${cursoPorCuenta.size} cuentas | user_progress: ${progreso.length} | user_access: ${accesos.length}`);
console.log('cuentas con course_data, por rol:', contar([...cursoPorCuenta.keys()], rolDe));
const alumnosSinCurso = usuarios.filter((u) => u.rol === 'alumno' && !cursoPorCuenta.has(u.id));
console.log(`alumnos (rol alumno) sin ninguna fila de course_data: ${alumnosSinCurso.length} (con planilla asignada: ${alumnosSinCurso.filter((u) => u.planilla_id).length})`);

// ------------------------------------------- 1. estructura del Mes 2 por cuenta

titulo('1. Mes 2 (semanas 5-8) de cada cuenta contra src/lib/planillas.ts');
const estado = new Map(); // user_id -> { clase, notas[] }
for (const [id, filas] of cursoPorCuenta) {
  const { pid, deducida } = planillaDeCuenta(id);
  const porModulo = new Map(filas.map((f) => [f.module_id, f]));
  const notas = [];
  let cruzado = false; let faltante = false; let desvio = false;
  for (const esp of mes2Esperado(pid)) {
    const fila = porModulo.get(esp.module_id);
    if (!fila) { faltante = true; notas.push(`${esp.module_id}: no tiene la fila`); continue; }
    if (fila.semana_numero !== esp.semana_numero || normTitle(fila.titulo) !== normTitle(esp.titulo)) {
      cruzado = true;
      notas.push(`${esp.module_id}: tiene "${fila.titulo}" (semana ${fila.semana_numero}) y la planilla dice "${esp.titulo}" (semana ${esp.semana_numero})`);
      continue;
    }
    const tiene = Array.isArray(fila.lessons) ? fila.lessons : [];
    const igualLargo = tiene.length === esp.lessons.length;
    const igualTitulos = igualLargo && esp.lessons.every((l, i) => normTitle(l.titulo) === normTitle(tiene[i]?.titulo));
    const igualIds = igualLargo && esp.lessons.every((l, i) => l.id === tiene[i]?.id);
    if (!igualTitulos || !igualIds) {
      desvio = true;
      notas.push(`${esp.module_id}: mismo módulo pero ${!igualTitulos ? 'títulos' : 'ids'} de lecciones distintos (${tiene.length} lecciones contra ${esp.lessons.length})`);
    }
  }
  const clase = cruzado ? 'orden viejo' : faltante ? 'Mes 2 incompleto' : desvio ? 'lecciones distintas' : 'alineado';
  estado.set(id, { clase, notas, pid, deducida });
}
const clases = ['alineado', 'orden viejo', 'lecciones distintas', 'Mes 2 incompleto'];
for (const c of clases) {
  const ids = [...estado.entries()].filter(([, e]) => e.clase === c).map(([id]) => id);
  console.log(`${c}: ${ids.length}`, ids.length ? contar(ids, rolDe) : '');
}
const cuentasViejas = [...estado.entries()].filter(([, e]) => e.clase === 'orden viejo').map(([id]) => id);
const alumnosViejos = cuentasViejas.filter((id) => rolDe(id) === 'alumno');
for (const [id, e] of estado) {
  if (e.clase === 'alineado') continue;
  console.log(`\n  ${nombrar(id)}${e.deducida ? ' (planilla deducida del prefijo de sus lecciones: ' + e.pid + ')' : ''} -> ${e.clase}`);
  for (const n of e.notas) console.log(`     - ${n}`);
}

// Cuentas que recibieron el orden INTERMEDIO (ver ORDEN_INTERMEDIO). Dos pistas:
// el backup del 25/5, y haber tildado `s7-5` / `s7-6`, ids que solo existieron
// con ese orden (hoy mod-7 tiene 5 lecciones y en el orden viejo también).
const sufijosHoy = new Set(getPlanillaForSave('livianos').filter((m) => SEMANAS_MES2.includes(m.semana_numero))
  .flatMap((m) => m.lessons.map((l) => partirId(l.id).sufijo)));
const soloIntermedio = [...HIST_INTERMEDIO.porSufijo.keys()].filter((s) => !sufijosHoy.has(s) && !HIST_VIEJO.porSufijo.has(s));
const cuentasIntermedias = new Set();
const hayRespaldoSwap = existsSync(RESPALDO_SWAP);
if (hayRespaldoSwap) {
  const filasSwap = JSON.parse(readFileSync(RESPALDO_SWAP, 'utf8'));
  let comparadas = 0; let distintas = 0;
  for (const f of filasSwap) {
    if (f?.module_id === 'mod-5' && normTitle(f.titulo) === normTitle('Escape 100KG I')) cuentasIntermedias.add(f.user_id);
  }
  // De paso se contrasta la mitad de la tabla que el backup sí tiene (mod-5 y mod-6).
  for (const f of filasSwap) {
    const tabla = ORDEN_INTERMEDIO.find((m) => m.module_id === f?.module_id);
    if (!tabla || !cuentasIntermedias.has(f.user_id)) continue;
    comparadas++;
    const tiene = (Array.isArray(f.lessons) ? f.lessons : []).map((l) => `${partirId(l.id).sufijo}=${normTitle(l.titulo)}`).join('|');
    if (tiene !== tabla.lecciones.map(([suf, t]) => `${suf}=${normTitle(t)}`).join('|') || normTitle(f.titulo) !== normTitle(tabla.titulo)) distintas++;
  }
  console.log(`\nTabla histórica del orden intermedio: ${cuentasIntermedias.size} cuentas en el backup del 25/5; mod-5 y mod-6 contrastados contra ${comparadas} filas -> ${distintas === 0 ? 'coincide' : 'NO coincide en ' + distintas + ' filas (revisar ORDEN_INTERMEDIO)'}. mod-7 y mod-8 no están en ese backup: salen del historial de git de planillas.ts.`);
}
for (const p of progreso) if (soloIntermedio.includes(partirId(p.lesson_id).sufijo)) cuentasIntermedias.add(p.user_id);
const historicoDe = (id) => (cuentasIntermedias.has(id) ? HIST_INTERMEDIO : HIST_VIEJO);

// ¿Las tablas históricas coinciden con lo que todavía hay en la base?
{
  let comparadas = 0; const diferencias = new Set();
  for (const id of cuentasViejas) {
    const porModulo = new Map((cursoPorCuenta.get(id) || []).map((f) => [f.module_id, f]));
    for (const viejo of historicoDe(id).orden) {
      const fila = porModulo.get(viejo.module_id);
      if (!fila) continue;
      comparadas++;
      const tiene = (Array.isArray(fila.lessons) ? fila.lessons : []).map((l) => `${partirId(l.id).sufijo}=${normTitle(l.titulo)}`).join('|');
      const espera = viejo.lecciones.map(([suf, t]) => `${suf}=${normTitle(t)}`).join('|');
      if (tiene !== espera || normTitle(fila.titulo) !== normTitle(viejo.titulo)) diferencias.add(viejo.module_id);
    }
  }
  console.log(`\nTabla histórica del orden viejo: contrastada contra ${comparadas} filas vivas -> ${diferencias.size === 0 ? 'coincide' : 'NO coincide en ' + [...diferencias].join(', ') + ' (revisar ORDEN_VIEJO antes de confiar en la sección 3)'}`);
}

// --------------------- 2. progreso de las cuentas que HOY tienen el orden viejo

titulo('2. Progreso de las cuentas que hoy tienen el orden viejo (lo que tocaría el paso de alineación)');
const resumen2 = { filas: 0, igual: 0, cambia: 0, sinMapeo: 0 };
for (const id of cuentasViejas) {
  const { pid } = estado.get(id);
  const info = new Map();
  for (const fila of cursoPorCuenta.get(id) || []) {
    for (const l of Array.isArray(fila.lessons) ? fila.lessons : []) info.set(l.id, { leccion: l.titulo, modulo: fila.titulo, semana: fila.semana_numero });
  }
  const filas = (progresoPorCuenta.get(id) || []).filter((p) => SEMANAS_MES2.includes(info.get(p.lesson_id)?.semana));
  console.log(`  ${nombrar(id)}: ${filas.length} lecciones de Mes 2 completadas (de ${(progresoPorCuenta.get(id) || []).length} en total)`);
  for (const p of filas) {
    const dato = info.get(p.lesson_id);
    const prop = mapearPorTitulo(pid, dato.modulo, dato.leccion);
    resumen2.filas++;
    if (!prop.id) resumen2.sinMapeo++; else if (prop.id === p.lesson_id) resumen2.igual++; else resumen2.cambia++;
    if (CON_DETALLE) console.log(`     ${partirId(p.lesson_id).sufijo} "${dato.leccion}" -> ${prop.id ? partirId(prop.id).sufijo : 'SIN MAPEO'} (${prop.via})`);
  }
}
if (cuentasViejas.length === 0) console.log('  (ninguna cuenta tiene el orden viejo)');
console.log(`  total: ${resumen2.filas} filas de progreso | quedan igual: ${resumen2.igual} | cambian de id: ${resumen2.cambia} | SIN mapeo por título: ${resumen2.sinMapeo}`);

// ------ 3. alumnos que tuvieron el orden viejo y fueron re-sincronizados sin mapear

titulo('3. Alumnos que TUVIERON el orden viejo y ya fueron pisados por "Sincronizar planillas"');
console.log('  Por qué importa: ese sync reescribe course_data con la planilla nueva y no toca user_progress.');
console.log('  Los ids no cambiaron de nombre pero sí de lección, así que lo que el alumno marcó con el');
console.log('  orden viejo hoy aparece tildado en OTRA lección. No se pierde ninguna fila; se corren las marcas.');

const viejoPorSufijo = HIST_VIEJO.porSufijo;
const sufijosNuevos = new Set(mes2Esperado('livianos').flatMap((m) => m.lessons.map((l) => partirId(l.id).sufijo)));
const soloViejo = [...viejoPorSufijo.keys()].filter((s) => !sufijosNuevos.has(s)); // ids que SOLO existieron con el orden viejo
const soloNuevo = [...sufijosNuevos].filter((s) => !viejoPorSufijo.has(s)); // ids que SOLO existen con el orden nuevo
console.log(`  ids que prueban orden viejo: ${soloViejo.join(', ')} | ids que prueban orden nuevo: ${soloNuevo.join(', ')}`);

const tuvieronViejo = new Set();
if (existsSync(RESPALDO_MAYO)) {
  for (const f of JSON.parse(readFileSync(RESPALDO_MAYO, 'utf8'))) if (f?.user_id) tuvieronViejo.add(f.user_id);
  console.log(`  cuentas con orden viejo según el backup del 19/5: ${tuvieronViejo.size}`);
} else {
  console.log('  (no está el backup del 19/5: se detecta solo por los ids que prueban orden viejo)');
}
for (const p of progreso) if (soloViejo.includes(partirId(p.lesson_id).sufijo)) tuvieronViejo.add(p.user_id);
// Si una cuenta cayera en los dos grupos (no debería), manda la prueba más fuerte: el orden viejo.
for (const id of tuvieronViejo) cuentasIntermedias.delete(id);
console.log(`  cuentas que recibieron el orden intermedio (alta entre el 11/5 y el 25/5; en ellas solo s7-* y s8-* cambiaron de lección): ${cuentasIntermedias.size}` +
  ` | ids que lo prueban: ${soloIntermedio.join(', ')}${hayRespaldoSwap ? '' : ' (no está el backup del 25/5: se detectan SOLO por esos ids, puede faltar alguna)'}`);

// Red de seguridad: cualquier marca s7-*/s8-* anterior al swap del 25/5 se hizo
// sí o sí con un orden que no es el de hoy. Si la cuenta no entró en ninguno de
// los dos grupos, el análisis de abajo no la ve: se cuenta para decirlo en el RESUMEN.
const fueraDelAnalisis = new Set();
for (const p of progreso) {
  if (tuvieronViejo.has(p.user_id) || cuentasIntermedias.has(p.user_id) || !cursoPorCuenta.has(p.user_id)) continue;
  if (/^s[78]-/.test(partirId(p.lesson_id).sufijo) && Date.parse(p.completed_at) < Date.parse(T_SWAP)) fueraDelAnalisis.add(p.user_id);
}

// A qué semana pertenece cada id con el orden de hoy (para la estimación por
// secuencia). La semana histórica depende de la cuenta y de la fecha: historicoDe(id).semanaEn().
const semanaNueva = new Map();
for (const m of mes2Esperado('livianos')) for (const l of m.lessons) semanaNueva.set(partirId(l.id).sufijo, m.semana_numero);
const ms = (iso) => (iso ? Date.parse(iso) : NaN);

const resumen3 = {
  cuentas: 0, conProgresoMes2: 0, viejoSeguro: 0, viejoEstimado: 0, indeciso: 0, nuevoEstimado: 0, nuevoSeguro: 0,
  cambian: 0, sinMapeo: 0, seDestildan: 0, seTildan: 0, duplicadas: 0, cuentasIntermedias: 0, intermediasConProgreso: 0, conCorridas: 0, intermediasConCorridas: 0,
};
// Qué lección es HOY cada id (planilla pelada, sin overrides: es solo para saber si el id cambió de lección).
const significadoHoy = new Map();
for (const m of getPlanillaForSave('livianos').filter((x) => SEMANAS_MES2.includes(x.semana_numero))) {
  for (const l of m.lessons) significadoHoy.set(partirId(l.id).sufijo, `${normTitle(m.titulo)}::${normTitle(l.titulo)}`);
}
for (const id of [...tuvieronViejo, ...cuentasIntermedias].sort()) {
  if (cuentasViejas.includes(id)) continue; // esas ya salieron en la sección 2
  if (!cursoPorCuenta.has(id)) continue;
  const hist = historicoDe(id);
  const esIntermedia = hist === HIST_INTERMEDIO;
  resumen3.cuentas++;
  if (esIntermedia) resumen3.cuentasIntermedias++;
  const { pid } = estado.get(id);
  // `corrida` = el id significaba otra lección con el orden histórico de ESTA
  // cuenta. En el orden viejo son todos; en el intermedio solo s7-* y s8-*
  // (s5-* y s6-* eran lo mismo que hoy: se dejan en la secuencia porque ayudan
  // a ubicar el corte, pero no se cuentan como marcas corridas).
  const marcas = (progresoPorCuenta.get(id) || [])
    .map((p) => ({ ...p, sufijo: partirId(p.lesson_id).sufijo, t: ms(p.completed_at) }))
    .filter((p) => hist.porSufijo.has(p.sufijo) || semanaNueva.has(p.sufijo))
    .map((p) => {
      const antes = hist.porSufijo.get(p.sufijo);
      return { ...p, mismaLeccion: Boolean(antes) && `${normTitle(antes.modulo)}::${normTitle(antes.leccion)}` === significadoHoy.get(p.sufijo) };
    })
    .sort((a, b) => (a.t - b.t) || a.lesson_id.localeCompare(b.lesson_id));
  if (!marcas.some((p) => !p.mismaLeccion)) continue;
  resumen3.conProgresoMes2++;
  if (esIntermedia) resumen3.intermediasConProgreso++;

  // LO SEGURO. El sync de una cuenta es un solo momento: antes, todos sus ids
  // de Mes 2 significaban lo viejo; después, lo nuevo. Ese momento cayó:
  //  - después de la última marca con un id que solo existía en el orden viejo;
  //  - antes de la primera marca con un id que solo existe en el orden nuevo;
  //  - y antes del último updated_at de sus filas de Mes 2 (que hoy están en el
  //    orden nuevo, así que desde esa escritura seguro ya lo estaban).
  // No se usa una fecha global porque el sync viejo se cortaba por tiempo y
  // alcanzaba a unos alumnos sí y a otros no.
  const tViejo = Math.max(...marcas.filter((p) => !semanaNueva.has(p.sufijo)).map((p) => p.t), -Infinity);
  const tFilas = Math.max(...(cursoPorCuenta.get(id) || []).filter((f) => SEMANAS_MES2.includes(f.semana_numero)).map((f) => ms(f.updated_at)).filter((x) => !Number.isNaN(x)), -Infinity);
  const tNuevo = Math.min(...marcas.filter((p) => !hist.porSufijo.has(p.sufijo)).map((p) => p.t), tFilas === -Infinity ? Infinity : tFilas);
  for (const p of marcas) p.clase = p.t <= tViejo ? 'viejo seguro' : p.t >= tNuevo ? 'nuevo seguro' : null;

  // LO ESTIMADO (heurística, no prueba). Entre esas dos fechas se prueba cada
  // posible momento de corte y se cuenta cuántas veces el alumno "vuelve para
  // atrás" de semana leyendo lo anterior al corte con el orden viejo y lo
  // posterior con el nuevo (el salto EN el corte no cuenta: es esperable que
  // después del sync vuelva a completar huecos). Se elige el corte con menos
  // retrocesos; si empatan varios, las marcas que quedan entre ellos son indecisas.
  const desde = marcas.filter((p) => p.clase === 'viejo seguro').length;
  const hasta = marcas.length - marcas.filter((p) => p.clase === 'nuevo seguro').length;
  let mejor = Infinity; let cortes = [];
  for (let k = desde; k <= hasta; k++) {
    const semanas = marcas.map((p, i) => (i < k ? hist.semanaEn(p.sufijo, p.t) : semanaNueva.get(p.sufijo)));
    let retrocesos = 0;
    for (let i = 1; i < semanas.length; i++) if (i !== k && semanas[i] < semanas[i - 1]) retrocesos++;
    if (retrocesos < mejor) { mejor = retrocesos; cortes = [k]; } else if (retrocesos === mejor) cortes.push(k);
  }
  marcas.forEach((p, i) => {
    if (p.clase) return;
    p.clase = i < Math.min(...cortes) ? 'viejo estimado' : i >= Math.max(...cortes) ? 'nuevo estimado' : 'indeciso';
  });

  // Qué pasaría si se reescribieran por título las marcas viejas (seguras +
  // estimadas) y se dejaran como están las nuevas y las indecisas.
  const hoy = new Set(marcas.map((p) => p.lesson_id));
  const despues = new Set();
  let cambian = 0; let sinMapeo = 0;
  for (const p of marcas) {
    p.destino = p.lesson_id;
    if (p.clase.startsWith('viejo')) {
      const antes = hist.porSufijo.get(p.sufijo);
      const prop = mapearPorTitulo(pid, antes.modulo, antes.leccion);
      p.eraLeccion = antes.leccion;
      if (!prop.id) sinMapeo++; else { p.destino = prop.id; if (prop.id !== p.lesson_id) cambian++; }
    }
    despues.add(p.destino);
  }
  const seDestildan = [...hoy].filter((x) => !despues.has(x)).length;
  const seTildan = [...despues].filter((x) => !hoy.has(x)).length;
  const duplicadas = marcas.length - despues.size; // misma lección tildada dos veces (una con cada orden)

  const n = contar(marcas.filter((p) => !p.mismaLeccion), (p) => p.clase);
  resumen3.viejoSeguro += n['viejo seguro'] || 0; resumen3.viejoEstimado += n['viejo estimado'] || 0;
  resumen3.indeciso += n.indeciso || 0; resumen3.nuevoEstimado += n['nuevo estimado'] || 0; resumen3.nuevoSeguro += n['nuevo seguro'] || 0;
  // "Con marcas corridas" = le queda al menos una marca que no es seguro/estimado
  // del orden de hoy. Una cuenta que hizo todo el Mes 2 después del sync no suma.
  if ((n['viejo seguro'] || 0) + (n['viejo estimado'] || 0) + (n.indeciso || 0) > 0) {
    resumen3.conCorridas++;
    if (esIntermedia) resumen3.intermediasConCorridas++;
  }
  resumen3.cambian += cambian; resumen3.sinMapeo += sinMapeo; resumen3.seDestildan += seDestildan; resumen3.seTildan += seTildan; resumen3.duplicadas += duplicadas;

  console.log(`\n  ${nombrar(id)}${esIntermedia ? ' [orden INTERMEDIO: solo s7-*/s8-* cambiaron de lección]' : ''}: ${marcas.length} marcas de Mes 2${esIntermedia ? `, ${marcas.filter((p) => !p.mismaLeccion).length} en ids que cambiaron de lección (los números de abajo cuentan solo esas)` : ''}`);
  console.log(`     orden viejo: ${n['viejo seguro'] || 0} seguras + ${n['viejo estimado'] || 0} estimadas | orden nuevo: ${n['nuevo seguro'] || 0} seguras + ${n['nuevo estimado'] || 0} estimadas | indecisas: ${n.indeciso || 0}`);
  console.log(`     el sync le cayó entre ${fecha(Number.isFinite(tViejo) ? new Date(tViejo).toISOString() : null)} y ${fecha(Number.isFinite(tNuevo) ? new Date(tNuevo).toISOString() : null)} (UTC)`);
  console.log(`     si se reescriben por título las viejas: ${cambian} cambian de id, ${sinMapeo} sin mapeo; se destildan ${seDestildan} ids que hoy figuran hechos sin haberlos hecho, se tildan ${seTildan}`);
  console.log(`     ${duplicadas} filas NO se podrían mover: la lección destino ya está tildada con el id nuevo (la clave de user_progress es user_id + lesson_id: o quedan donde están, o se borran, y el plan prohíbe borrar progreso)`);
  if (CON_DETALLE) {
    for (const p of marcas) {
      const mov = p.clase.startsWith('viejo') ? ` era "${p.eraLeccion}" -> ${p.destino === p.lesson_id ? 'mismo id' : partirId(p.destino).sufijo}` : '';
      console.log(`       ${fecha(p.completed_at)}  ${p.sufijo.padEnd(13)} ${p.clase.padEnd(15)}${mov}`);
    }
  }
}
console.log(`\n  total: ${resumen3.cuentas} cuentas re-sincronizadas que venían de un orden anterior (${resumen3.cuentas - resumen3.cuentasIntermedias} del viejo + ${resumen3.cuentasIntermedias} del intermedio); ${resumen3.conProgresoMes2} con progreso en Mes 2 (${resumen3.intermediasConProgreso} del intermedio)`);
console.log(`  cuentas con marcas s7-*/s8-* anteriores al 25/5 que NO entraron en ninguno de los dos grupos (quedan fuera de este análisis): ${fueraDelAnalisis.size}`);
console.log(`  marcas hechas con el orden viejo: ${resumen3.viejoSeguro} seguras + ${resumen3.viejoEstimado} estimadas | con el nuevo: ${resumen3.nuevoSeguro} seguras + ${resumen3.nuevoEstimado} estimadas | indecisas: ${resumen3.indeciso}`);
console.log(`  de las viejas: ${resumen3.cambian} cambiarían de id, ${resumen3.sinMapeo} SIN mapeo por título, ${resumen3.duplicadas} no se podrían mover porque la lección ya está tildada con el id nuevo`);
console.log('  ("estimadas" = heurística por secuencia de semanas, no prueba. Con --detalle se ve marca por marca.)');

// ------------------------------------------------------ 4. progreso huérfano

titulo('4. user_progress cuyo lesson_id no existe en el course_data del alumno ni en su planilla');
const tituloMock = new Map();
for (const [modId, lecciones] of Object.entries(datosMock.MOCK_LESSONS || {})) {
  for (const l of lecciones) tituloMock.set(l.id, { leccion: l.titulo, module_id: modId });
}
const resumen4 = { filas: 0, recuperables: 0, yaCubiertas: 0, sinMapeo: 0, porForma: {}, porRol: {}, deAlumnos: { recuperables: 0, yaCubiertas: 0, sinMapeo: 0 }, titulosSinMapeo: new Set() };
const anotar4 = (categoria, id) => { resumen4[categoria]++; if (rolDe(id) === 'alumno') resumen4.deAlumnos[categoria]++; };
for (const [id, filas] of progresoPorCuenta) {
  const propios = new Set();
  for (const fila of cursoPorCuenta.get(id) || []) for (const l of Array.isArray(fila.lessons) ? fila.lessons : []) propios.add(l.id);
  const pid = estado.get(id)?.pid ?? planillaDeCuenta(id).pid;
  const planilla = planillaGuardable(pid) || [];
  const idsPlanilla = new Set(planilla.flatMap((m) => m.lessons.map((l) => l.id)));
  const tildados = new Set(filas.map((p) => p.lesson_id));
  for (const p of filas) {
    if (propios.has(p.lesson_id) || idsPlanilla.has(p.lesson_id)) continue;
    resumen4.filas++;
    const { sufijo } = partirId(p.lesson_id);
    const forma = sufijo.replace(/[0-9]+/g, 'N');
    resumen4.porForma[forma] = (resumen4.porForma[forma] || 0) + 1;
    resumen4.porRol[rolDe(id)] = (resumen4.porRol[rolDe(id)] || 0) + 1;
    // Propuesta: por título. Para ids del orden viejo, con la tabla histórica;
    // para ids `les-N-N` (los del mock de abril), con el título del mock dentro
    // del mismo module_id de la planilla.
    let propuesto = null;
    const hist4 = historicoDe(id); // el orden que tuvo ESTA cuenta (viejo o intermedio)
    if (hist4.porSufijo.has(sufijo)) {
      const antes = hist4.porSufijo.get(sufijo);
      propuesto = mapearPorTitulo(pid, antes.modulo, antes.leccion).id;
    } else if (tituloMock.has(p.lesson_id)) {
      const m = tituloMock.get(p.lesson_id);
      const candidatas = (planilla.find((x) => x.module_id === m.module_id)?.lessons || []).filter((l) => normTitle(l.titulo) === normTitle(m.leccion));
      if (candidatas.length === 1) propuesto = candidatas[0].id;
    }
    if (!propuesto) {
      anotar4('sinMapeo', id);
      // El título es contenido del curso, no un dato del alumno: se puede mostrar.
      resumen4.titulosSinMapeo.add(`${p.lesson_id.startsWith('les-') ? p.lesson_id : sufijo}${tituloMock.has(p.lesson_id) ? ' "' + tituloMock.get(p.lesson_id).leccion + '"' : ''}`);
    } else if (tildados.has(propuesto)) anotar4('yaCubiertas', id);
    else anotar4('recuperables', id);
  }
}
const a4 = resumen4.deAlumnos;
console.log(`  filas huérfanas: ${resumen4.filas}`, resumen4.porForma, 'por rol:', resumen4.porRol);
console.log('  (las "-conceptos" son las mismas marcas seguras del orden viejo de la sección 3; las "les-N-N" son ids del mock de abril)');
console.log(`  con mapeo por título a una lección que la cuenta NO tiene tildada (recuperables): ${resumen4.recuperables} (de alumnos: ${a4.recuperables})`);
console.log(`  con mapeo pero la lección destino ya está tildada (mover la fila chocaría; no suma nada): ${resumen4.yaCubiertas} (de alumnos: ${a4.yaCubiertas})`);
console.log(`  SIN mapeo por título: ${resumen4.sinMapeo} (de alumnos: ${a4.sinMapeo})${resumen4.titulosSinMapeo.size ? ' -> ' + [...resumen4.titulosSinMapeo].join(' | ') : ''}`);

// -------------------------------------------------------------- 5. user_access

titulo('5. Módulos de course_data sin fila en user_access');
const claveAcceso = new Set(accesos.map((a) => `${a.user_id}::${a.module_id}`));
const sinAcceso = courseData.filter((f) => !claveAcceso.has(`${f.user_id}::${f.module_id}`));
const sinAccesoMes2 = sinAcceso.filter((f) => SEMANAS_MES2.includes(f.semana_numero));
console.log(`  total: ${sinAcceso.length} módulos en ${new Set(sinAcceso.map((f) => f.user_id)).size} cuentas | por rol:`, contar(sinAcceso, (f) => rolDe(f.user_id)));
console.log(`  solo semanas 5-8: ${sinAccesoMes2.length} módulos en ${new Set(sinAccesoMes2.map((f) => f.user_id)).size} cuentas | por rol:`, contar(sinAccesoMes2, (f) => rolDe(f.user_id)));
const porSemana = contar(sinAcceso, (f) => f.semana_numero);
console.log('  por semana:', Object.keys(porSemana).map(Number).sort((a, b) => a - b).map((s) => `s${s}: ${porSemana[s]}`).join('  '));
// ¿Son módulos a los que el alumno todavía no llegó, o agujeros en el medio?
// Un agujero = falta la fila de una semana ANTERIOR a otra que sí tiene abierta.
let agujeros = 0; let alumnosConFaltantes = 0;
for (const [id, filas] of agrupar(sinAcceso, (f) => f.user_id)) {
  if (rolDe(id) !== 'alumno') continue;
  alumnosConFaltantes++;
  const abiertos = new Set((accesoPorCuenta.get(id) || []).filter((a) => a.is_unlocked).map((a) => a.module_id));
  const ultimaAbierta = Math.max(...(cursoPorCuenta.get(id) || []).filter((f) => abiertos.has(f.module_id)).map((f) => f.semana_numero), -Infinity);
  agujeros += filas.filter((f) => f.semana_numero < ultimaAbierta).length;
}
console.log(`  de alumnos: ${alumnosConFaltantes} cuentas; filas faltantes de una semana anterior a la última que tienen abierta (agujeros): ${agujeros}`);
console.log('  Ojo al leerlo: hoy una fila faltante se comporta igual que "bloqueado" (el gate de /api/course-data');
console.log('  exige is_unlocked = true) y todo lo que desbloquea usa upsert, así que no le rompe nada al alumno.');
const claveCurso = new Set(courseData.map((f) => `${f.user_id}::${f.module_id}`));
const accesoSinCurso = accesos.filter((a) => !claveCurso.has(`${a.user_id}::${a.module_id}`));
console.log(`  al revés (user_access sin course_data): ${accesoSinCurso.length} filas en ${new Set(accesoSinCurso.map((a) => a.user_id)).size} cuentas`);

// Desbloqueos salteados dentro del Mes 2: como user_access va por module_id y el
// module_id cambió de semana, un alumno re-sincronizado puede tener abierta la
// semana 7 y cerrada la 5.
let salteados = 0;
for (const [id, filas] of cursoPorCuenta) {
  if (rolDe(id) !== 'alumno') continue;
  const abiertos = new Set((accesoPorCuenta.get(id) || []).filter((a) => a.is_unlocked).map((a) => a.module_id));
  const mes2 = filas.filter((f) => SEMANAS_MES2.includes(f.semana_numero)).sort((a, b) => a.semana_numero - b.semana_numero);
  const patron = mes2.map((f) => (abiertos.has(f.module_id) ? 'A' : 'c')).join('');
  if (/cA/.test(patron)) {
    salteados++;
    console.log(`  desbloqueo salteado -> ${nombrar(id)}: semanas 5-8 = ${patron} (A = abierta, c = cerrada)`);
  }
}
console.log(`  alumnos con una semana del Mes 2 abierta y una anterior cerrada: ${salteados}`);

// Overrides de video del Mes 2 que quedaron colgados del module_id viejo: son
// la razón por la que /api/course-data tiene el fallback "por título".
const overridesCorridos = overrides.filter((o) => {
  const mod = mes2Esperado('livianos').find((m) => m.module_id === o.module_id);
  return mod && !mod.lessons.some((l) => normTitle(l.titulo) === o.lesson_key);
});
console.log(`  overrides de video de mod-5..mod-8 cuyo título ya no está en ese módulo: ${overridesCorridos.length}` +
  (overridesCorridos.length ? ` (${overridesCorridos.map((o) => `${o.module_id}: ${o.lesson_key}`).join(' | ')})` : ''));

// ------------------------------------------------------------------ resumen

titulo('RESUMEN');
console.log(`  cuentas con el orden viejo en semanas 5-8: ${cuentasViejas.length} (de rol alumno: ${alumnosViejos.length})`);
console.log(`  cuentas con otras diferencias en semanas 5-8: ${[...estado.values()].filter((e) => e.clase === 'lecciones distintas' || e.clase === 'Mes 2 incompleto').length}`);
console.log(`  progreso de esas cuentas sin mapeo por título: ${resumen2.sinMapeo} (de ${resumen2.filas} filas)`);
console.log(`  alumnos ya re-sincronizados con marcas de Mes 2 corridas o dudosas: ${resumen3.conCorridas} (${resumen3.conCorridas - resumen3.intermediasConCorridas} venían del orden viejo + ${resumen3.intermediasConCorridas} del intermedio; otras ${resumen3.conProgresoMes2 - resumen3.conCorridas} hicieron todo el Mes 2 después del sync; fuera del análisis: ${fueraDelAnalisis.size}; marcas del orden viejo: ${resumen3.viejoSeguro} seguras + ${resumen3.viejoEstimado} estimadas; indecisas: ${resumen3.indeciso}; sin mapeo por título: ${resumen3.sinMapeo})`);
console.log(`  user_progress huérfano: ${resumen4.filas} filas (${resumen4.sinMapeo} sin mapeo por título; de alumnos: ${a4.sinMapeo})`);
console.log(`  módulos sin fila en user_access: ${sinAcceso.length} (semanas 5-8: ${sinAccesoMes2.length}; agujeros reales en alumnos: ${agujeros})`);

if (ESTRICTO) {
  const pendiente = [...estado.values()].filter((e) => e.clase !== 'alineado').length + sinAcceso.length;
  if (pendiente > 0) {
    console.log(`\n--estricto: quedan ${pendiente} cosas por alinear -> salida 1`);
    process.exit(1);
  }
}

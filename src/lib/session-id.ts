/**
 * Validación del `session_id` anónimo del embudo (WP-03).
 *
 * El navegador genera el id y lo manda en cada POST a /api/leads/*. Hay DOS
 * formatos reales dando vueltas:
 *
 *   1. UUID, de `crypto.randomUUID()`. Es el caso normal (las 749 filas de
 *      lead_quiz_responses y las 34 de match_quiz_responses al 19/9 son UUID v4).
 *   2. El de respaldo de EvaluationQuiz.tsx para navegadores sin randomUUID
 *      (iPhone con iOS anterior a 15.4, Android viejos):
 *        `${Date.now()}-${Math.random().toString(36).slice(2)}`
 *      por ejemplo "1758300000000-k3j2h1g9x8". Eso NO es un UUID.
 *
 * El problema que esto resuelve: la columna `session_id` es de tipo `uuid` en
 * las dos tablas (verificado contra producción). Con el formato de respaldo,
 * Postgres contesta 22P02 "invalid input syntax for type uuid" y el lead se
 * perdía con un 500 que nadie veía (el cliente hace `void fetch`). En vez de
 * rechazarlo, lo convertimos a un UUID derivado, siempre el mismo para el mismo
 * texto, así todas las llamadas de esa persona (quiz, phone, check, near-miss,
 * calendly-event) caen en la misma fila.
 *
 * Este archivo no importa nada de Node a propósito: `esSessionIdValido` tiene
 * que poder usarse también desde un componente del navegador.
 */

// Sin barras invertidas en los regex (regla 3 del plan): clases explícitas.
// Aceptamos cualquier versión de UUID, no solo v4: la base acepta todas y las
// validaciones que había antes tampoco miraban la versión. Ponernos más
// estrictos que la base solo serviría para rechazar leads reales.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Date.now() hoy tiene 13 dígitos; dejamos 10–16 de margen. La parte aleatoria
// en base 36 suele tener 10–12 caracteres, pero puede salir más corta (incluso
// vacía si Math.random() diera 0), por eso el mínimo es 0.
const RE_RESPALDO = /^[0-9]{10,16}-[a-z0-9]{0,24}$/;

const LARGO_MIN = 8;
const LARGO_MAX = 100;

/**
 * ¿Es un session_id con alguno de los dos formatos que genera nuestro cliente?
 * Tolera espacios alrededor (las rutas siempre hicieron `.trim()`).
 */
export function esSessionIdValido(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const limpio = v.trim();
  if (limpio.length < LARGO_MIN || limpio.length > LARGO_MAX) return false;
  return RE_UUID.test(limpio) || RE_RESPALDO.test(limpio);
}

/**
 * Devuelve el session_id tal como hay que usarlo contra la base (columna
 * `uuid`), o `null` si no es válido.
 *
 *   - UUID            → el mismo, en minúsculas (para que "ABC..." y "abc..."
 *                       sean la misma clave también en el rate limit).
 *   - id de respaldo  → UUID derivado con SHA-256. Lleva versión 8 ("formato
 *                       propio" según el RFC 9562), así nunca puede coincidir
 *                       con el UUID v4 de otra persona.
 *
 * Es async porque usa Web Crypto (`crypto.subtle`), que existe igual en Node 20+
 * y en el navegador, sin importar nada.
 */
export async function sessionIdParaBase(v: unknown): Promise<string | null> {
  if (!esSessionIdValido(v)) return null;
  const limpio = v.trim();
  if (RE_UUID.test(limpio)) return limpio.toLowerCase();
  return uuidDerivado(limpio);
}

async function uuidDerivado(texto: string): Promise<string> {
  // El prefijo separa este uso de cualquier otro hash del mismo texto.
  const entrada = new TextEncoder().encode(`jjl-session:${texto}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entrada));
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // versión 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante estándar
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

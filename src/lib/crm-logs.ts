import 'server-only';
import { google } from 'googleapis';
import { dateKeyInAppTz } from '@/lib/dates';

/**
 * Lectura de los LOG_* del CRM (planilla de Google Sheets).
 *
 * ManyChat escribe una fila cada vez que le manda un mensaje a alguien, en una
 * pestaña distinta por tipo de mensaje. O sea que **cada pestaña LOG_ es una
 * etiqueta**: estar en LOG_PROBLEMA_FRUST significa que a esa persona le
 * llegó el mensaje de problema/frustración. El setter después les escribe a
 * mano.
 *
 * Las pestañas NO están fijas en el código a propósito. Antes lo estaban y se
 * rompió: se pedían LOG_PROBLEMA y LOG_TESTIMONIO, que nunca existieron
 * (están partidas en _PRINC / _FRUST / _JUEGO), Sheets devolvía "Unable to
 * parse range" y como se piden todas juntas en un batchGet, esa sola falla
 * volteaba la lectura entera. Ahora se descubren solas, así que agregar una
 * etiqueta nueva en el CRM no requiere tocar nada acá.
 *
 * Formato esperado: columna A = FECHA, columna B = USUARIO. Las pestañas con
 * otro encabezado (LOG_STORIES, LOG_CONTENIDO) no son de personas y se
 * descartan por el encabezado, no por una lista negra.
 *
 * La planilla está compartida como LECTOR con el service account de la app.
 */

const CRM_SPREADSHEET_ID = '1HJqfRt2fst9Ug1Q8g536U3xvhpGferlosRXYxABLwiU';

export interface Etiqueta {
  /** Clave estable — se guarda en `crm_followups.tipo_log`. */
  tipo: string;
  /** Nombre real de la pestaña. */
  tab: string;
  label: string;
}

export interface CrmLogEntry {
  tipo: string;
  /** Nombre visible de Instagram, que es lo que reporta ManyChat. */
  usuario: string;
  /**
   * Usuario real de Instagram (sin @), si la pestaña lo trae.
   *
   * Es lo único que permite abrirle el chat a la persona correcta. ManyChat
   * hoy escribe el nombre visible: cuando ese nombre ya es el @ se puede
   * linkear igual, pero un "Martín Blanco" no lleva a ningún lado. Ver
   * COLUMNA_HANDLE.
   */
  handle: string | null;
  /** ISO del momento en que ManyChat mandó el mensaje. */
  fecha: string;
  /** YYYY-MM-DD en horario argentino. */
  dia: string;
}

/**
 * Encabezados que se aceptan para la columna con el usuario de Instagram.
 *
 * La columna es OPCIONAL y todavía no existe: hay que agregarla en la acción
 * de Google Sheets de cada flujo de ManyChat, con el campo del usuario de
 * Instagram. En cuanto aparezca con uno de estos nombres, el panel empieza a
 * linkear al chat de la persona sin tocar nada más.
 */
const COLUMNA_HANDLE = /^(ig|instagram|usuario[ _]?ig|handle|arroba)$/i;

/** Un @ de Instagram válido: letras, números, punto y guion bajo. */
function limpiarHandle(raw: unknown): string | null {
  const h = String(raw ?? '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
}

/**
 * Nombres lindos para las etiquetas conocidas. Si aparece una nueva en el CRM
 * igual se muestra, con el nombre de la pestaña prolijeado.
 */
const LABELS: Record<string, string> = {
  calendario: 'Calendario',
  problema_princ: 'Problema principal',
  problema_frust: 'Problema · frustración',
  problema_juego: 'Problema · juego',
  testimonio_princ: 'Testimonio principal',
  testimonio_frust: 'Testimonio · frustración',
  testimonio_juego: 'Testimonio · juego',
  inbound: 'Inbound',
  outbound: 'Outbound',
  '4_pregunta': '4ª pregunta',
  audio: 'Audio',
  no_agendo: 'No agendó',
  form: 'Form',
  calificado: 'Calificado',
  seguidores: 'Seguidores',
  rtanuevoseguidor: 'Rta. nuevo seguidor',
};

/**
 * Etiquetas que arrancan apagadas en el panel.
 *
 * `seguidores` tiene 4.400+ filas pero NINGUNA con nombre: la pestaña guarda
 * solo la fecha, así que es un contador de seguidores nuevos y no una lista de
 * gente a la que escribirle. Hoy no produce ningún follow-up (las filas sin
 * usuario se descartan igual); queda silenciada por si algún día empiezan a
 * completar la columna, para que no tape el resto de golpe.
 */
export const ETIQUETAS_SILENCIADAS = ['seguidores'];

/** Clave estable a partir del nombre de pestaña. */
function slugDe(tab: string): string {
  return tab
    .replace(/^LOG\s*_?\s*/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function labelDe(tipo: string): string {
  if (LABELS[tipo]) return LABELS[tipo];
  const t = tipo.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Cache en memoria: la planilla cambia de a poco y el panel se recarga seguido.
// Sin esto, cada refresh pega contra la API de Sheets y se come la cuota.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; entries: CrmLogEntry[]; etiquetas: Etiqueta[] } | null = null;

function sheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurada');
  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    // Vercel a veces deja los saltos de línea escapados.
    key: String(key.private_key).replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Parsea la fecha de una fila.
 *
 * Pidiendo los valores sin formatear, las celdas de fecha llegan como número
 * de serie de Sheets (días desde 1899-12-30), no como texto. Antes se leían
 * formateadas y parecían ISO, pero eso depende del locale de la planilla
 * (es_AR las devuelve con coma decimal), así que se rompía solo.
 *
 * La planilla está en America/Buenos_Aires, que es UTC-3 fijo (Argentina no
 * tiene horario de verano), así que el número representa hora argentina. Sin
 * ese ajuste, una fila de las 22:00 caería en el día siguiente y el setter la
 * vería en el día equivocado.
 */
const MS_POR_DIA = 86_400_000;
/** Días entre la época de Sheets (1899-12-30) y la de Unix (1970-01-01). */
const EPOCA_SHEETS = 25_569;
const OFFSET_AR_MS = 3 * 3_600_000;

function parseFecha(raw: unknown): Date | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const dt = new Date(Math.round((raw - EPOCA_SHEETS) * MS_POR_DIA) + OFFSET_AR_MS);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  // Texto ISO — por si alguna pestaña guarda la fecha como string.
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const dt = new Date(`${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${se || '00'}-03:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Una pestaña sirve si su encabezado es FECHA | USUARIO. */
function esLogDePersonas(header: unknown[]): boolean {
  const a = String(header?.[0] ?? '').trim().toUpperCase();
  const b = String(header?.[1] ?? '').trim().toUpperCase();
  return a === 'FECHA' && b === 'USUARIO';
}

/** Índice de la columna con el @ de Instagram, o -1 si esa pestaña no la tiene. */
function indiceHandle(header: unknown[]): number {
  for (let i = 2; i < header.length; i++) {
    if (COLUMNA_HANDLE.test(String(header[i] ?? '').trim())) return i;
  }
  return -1;
}

/** Lee todas las pestañas de log y devuelve las filas, más nuevas primero. */
export async function fetchCrmLogs(): Promise<{ entries: CrmLogEntry[]; etiquetas: Etiqueta[] }> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { entries: cache.entries, etiquetas: cache.etiquetas };
  }

  const sheets = sheetsClient();

  // Primero qué pestañas existen. Pedir un nombre inventado hace fallar el
  // batchGet completo, así que nunca pedimos una que no esté.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: CRM_SPREADSHEET_ID,
    fields: 'sheets.properties.title',
  });
  const tabs = (meta.data.sheets || [])
    .map((s) => s.properties?.title || '')
    .filter((t) => /^LOG/i.test(t));

  if (tabs.length === 0) {
    cache = { at: Date.now(), entries: [], etiquetas: [] };
    return { entries: [], etiquetas: [] };
  }

  // A1 para poder mirar el encabezado: sirve para descartar las pestañas que
  // no son de personas y para ubicar la columna del @ de Instagram.
  // Hasta la E para que esa columna se pueda agregar en cualquier lado.
  // UNFORMATTED_VALUE para que las fechas vengan como número y no dependan del
  // locale de la planilla.
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: CRM_SPREADSHEET_ID,
    ranges: tabs.map((tab) => `${tab}!A1:E`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const entries: CrmLogEntry[] = [];
  const etiquetas: Etiqueta[] = [];

  (res.data.valueRanges || []).forEach((range, i) => {
    const filas = (range.values || []) as unknown[][];
    if (filas.length === 0 || !esLogDePersonas(filas[0])) return;

    const tab = tabs[i];
    const tipo = slugDe(tab);
    if (!tipo) return;
    etiquetas.push({ tipo, tab, label: labelDe(tipo) });

    const idxHandle = indiceHandle(filas[0]);

    for (const row of filas.slice(1)) {
      // La C se usa como respaldo del nombre solo si NO es la columna del
      // handle: en filas viejas el nombre quedó corrido a esa columna.
      const respaldo = idxHandle === 2 ? '' : String(row?.[2] ?? '').trim();
      const usuario = String(row?.[1] ?? '').trim() || respaldo;
      // Sin usuario no hay a quién escribirle: ManyChat a veces escribe la
      // fila antes de resolver el nombre. Se descartan.
      if (!usuario) continue;
      const dt = parseFecha(row?.[0]);
      if (!dt) continue;

      // El handle SOLO sale de su columna. Se intentó deducirlo del nombre
      // visible (si no tiene espacios, será el @) y estaba mal: "Martin",
      // "Max" y "Sofii" pasan el filtro pero son nombres de pila, así que el
      // link caía en el DM de un desconocido con ese @. Mandar al setter a
      // escribirle a la persona equivocada es peor que no darle el link.
      const handle = idxHandle >= 0 ? limpiarHandle(row?.[idxHandle]) : null;

      entries.push({
        tipo,
        usuario,
        handle,
        fecha: dt.toISOString(),
        dia: dateKeyInAppTz(dt),
      });
    }
  });

  // La planilla no viene ordenada por fecha.
  entries.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  etiquetas.sort((a, b) => a.label.localeCompare(b.label, 'es'));

  cache = { at: Date.now(), entries, etiquetas };
  return { entries, etiquetas };
}

/** Clave estable de un follow-up, para cruzar con la tabla de estado. */
export function followupKey(e: { tipo: string; usuario: string; fecha: string }): string {
  return `${e.tipo}|${e.usuario}|${e.fecha}`;
}

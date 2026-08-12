import 'server-only';
import { google } from 'googleapis';
import { dateKeyInAppTz } from '@/lib/dates';

/**
 * Lectura de los LOG_* del CRM (planilla de Google Sheets).
 *
 * ManyChat va escribiendo una fila por cada mensaje que manda, en una pestaña
 * por tipo de log. El setter necesita ver a quién le llegó cada log el día
 * anterior para hacerle el seguimiento a mano.
 *
 * Formato de cada pestaña: columna A = FECHA (ISO), columna B = USUARIO
 * (el nombre de Instagram tal como lo reporta ManyChat).
 *
 * La planilla está compartida como LECTOR con el service account de la app
 * (el mismo que ya se usa para Drive), así que no hace falta ningún script
 * externo ni sincronización: se lee en vivo.
 */

const CRM_SPREADSHEET_ID = '1HJqfRt2fst9Ug1Q8g536U3xvhpGferlosRXYxABLwiU';

/**
 * Los logs que el setter sigue hoy. El valor es un PREFIJO, no el nombre exacto
 * de una pestaña.
 *
 * En la planilla no hay una pestaña por tipo: los problemas están partidos en
 * LOG_PROBLEMA_PRINC / _FRUST / _JUEGO y los testimonios igual. Al pedir el
 * nombre exacto, Sheets respondía "Unable to parse range: LOG_PROBLEMA!A2:B" y
 * como las pestañas se piden todas juntas en un batchGet, esa sola falla
 * volteaba la lectura entera y el panel quedaba vacío.
 *
 * Resolviendo por prefijo contra las pestañas que existen de verdad, el panel
 * también toma solo las variantes nuevas que agreguen sin tocar el código.
 */
export const TIPOS_LOG = {
  calendario: 'LOG_CALENDARIO',
  problema: 'LOG_PROBLEMA',
  testimonio: 'LOG_TESTIMONIO',
} as const;

export type TipoLog = keyof typeof TIPOS_LOG;

export const TIPO_LOG_LABEL: Record<TipoLog, string> = {
  calendario: 'Calendario',
  problema: 'Problema',
  testimonio: 'Testimonio',
};

export interface CrmLogEntry {
  tipo: TipoLog;
  usuario: string;
  /** ISO del momento en que ManyChat mandó el mensaje. */
  fecha: string;
  /** YYYY-MM-DD en horario argentino — es la clave por la que se agrupa. */
  dia: string;
}

// Cache en memoria: la planilla cambia de a poco y el panel se recarga seguido.
// Sin esto, cada refresh del setter pega 3 veces contra la API de Sheets y se
// come la cuota por minuto.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; entries: CrmLogEntry[] } | null = null;

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

/** Lee las 3 pestañas y devuelve las filas normalizadas, más nuevas primero. */
export async function fetchCrmLogs(): Promise<CrmLogEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.entries;

  const sheets = sheetsClient();

  // Primero preguntamos qué pestañas existen y las clasificamos por prefijo.
  // Pedir un nombre inventado hace fallar el batchGet completo, así que nunca
  // pedimos una que no esté.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: CRM_SPREADSHEET_ID,
    fields: 'sheets.properties.title',
  });
  const titulos = (meta.data.sheets || [])
    .map((s) => s.properties?.title || '')
    .filter(Boolean);

  const tabs: [TipoLog, string][] = [];
  for (const [tipo, prefijo] of Object.entries(TIPOS_LOG) as [TipoLog, string][]) {
    for (const t of titulos) {
      if (t.toUpperCase().startsWith(prefijo)) tabs.push([tipo, t]);
    }
  }
  if (tabs.length === 0) {
    cache = { at: Date.now(), entries: [] };
    return [];
  }

  // batchGet: una sola request para todas las pestañas.
  // UNFORMATTED_VALUE para que las fechas vengan como número y no dependan del
  // locale de la planilla. Hasta la C porque en algunas filas viejas el nombre
  // quedó corrido a esa columna.
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: CRM_SPREADSHEET_ID,
    ranges: tabs.map(([, tab]) => `${tab}!A2:C`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const entries: CrmLogEntry[] = [];
  (res.data.valueRanges || []).forEach((range, i) => {
    const tipo = tabs[i][0];
    for (const row of (range.values || []) as unknown[][]) {
      const usuario = (String(row?.[1] ?? '').trim() || String(row?.[2] ?? '').trim());
      // Sin usuario no hay a quién escribirle: ManyChat a veces escribe la
      // fila antes de resolver el nombre. Se descartan.
      if (!usuario) continue;
      const dt = parseFecha(row?.[0]);
      if (!dt) continue;
      entries.push({
        tipo,
        usuario,
        fecha: dt.toISOString(),
        dia: dateKeyInAppTz(dt),
      });
    }
  });

  // La planilla no viene ordenada por fecha.
  entries.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  cache = { at: Date.now(), entries };
  return entries;
}

/** Clave estable de un follow-up, para cruzar con la tabla de estado. */
export function followupKey(e: { tipo: string; usuario: string; fecha: string }): string {
  return `${e.tipo}|${e.usuario}|${e.fecha}`;
}

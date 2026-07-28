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

/** Los logs que el setter sigue hoy. La clave es el nombre real de la pestaña. */
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
 * Parsea la fecha de la planilla. Vienen en ISO ("2026-07-22 18:30:03"), sin
 * zona horaria: se interpretan como hora argentina, que es como las escribe
 * ManyChat.
 */
function parseFecha(raw: string): Date | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  // -03:00 = Argentina. Sin esto, una fila de las 22:00 caería en el día
  // siguiente al convertir a UTC y el setter la vería en el día equivocado.
  const iso = `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}:${se || '00'}-03:00`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Lee las 3 pestañas y devuelve las filas normalizadas, más nuevas primero. */
export async function fetchCrmLogs(): Promise<CrmLogEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.entries;

  const sheets = sheetsClient();
  const tabs = Object.entries(TIPOS_LOG) as [TipoLog, string][];

  // batchGet: una sola request para las 3 pestañas.
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: CRM_SPREADSHEET_ID,
    ranges: tabs.map(([, tab]) => `${tab}!A2:B`),
  });

  const entries: CrmLogEntry[] = [];
  (res.data.valueRanges || []).forEach((range, i) => {
    const tipo = tabs[i][0];
    for (const row of (range.values || []) as string[][]) {
      const usuario = (row?.[1] || '').trim();
      // Sin usuario no hay a quién escribirle: ManyChat a veces escribe la
      // fila antes de resolver el nombre. Se descartan.
      if (!usuario) continue;
      const dt = parseFecha(row?.[0] || '');
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

import 'server-only';
import { google } from 'googleapis';

/**
 * Ventas del CRM (pestaña LOOKER de la planilla).
 *
 * Nadie marcaba las ventas a mano, asi que `lead_sales` estuvo vacia meses y
 * el cash collected y la comision del setter daban cero. Pero el dato SI
 * existe: el CRM lleva una fila por consultoria con `Cerro` y
 * `Cash Total (pagos)`. Esto lo lee y lo carga.
 *
 * Columnas de LOOKER (A..M):
 *   A Nombre · B Mes · C Fecha Agenda · D Fuente · E Setter · F Closer
 *   G Programa · H Calificado · I Show Up · J Cerro · K Situacion
 *   L Cash Total (pagos) · M Monto Restante
 */

const CRM_SPREADSHEET_ID = '1HJqfRt2fst9Ug1Q8g536U3xvhpGferlosRXYxABLwiU';
const HOJA = 'LOOKER';

export interface VentaCrm {
  /** Nombre tal cual figura en el CRM. Es la clave para no duplicar. */
  nombre: string;
  monto: number;
  /** ISO del mes de la venta. El CRM no guarda el dia exacto del pago. */
  fecha: string;
  /** Lo que resta cobrar, si esta cargado. */
  restante: number;
  programa: string;
}

/** Dias entre la epoca de Sheets (1899-12-30) y la de Unix. */
const EPOCA_SHEETS = 25_569;
const MS_POR_DIA = 86_400_000;

function fechaDeSerial(n: unknown): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const d = new Date(Math.round((n - EPOCA_SHEETS) * MS_POR_DIA));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurada');
  const key = JSON.parse(raw) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: String(key.private_key).replace(/\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Ventas con plata cobrada. `montoMinimo` filtra el low ticket: las de menos
 * de $300 son cursos sueltos y cuotas, que no son del programa y ensucian la
 * comision del setter.
 */
export async function ventasDelCrm(montoMinimo = 300): Promise<VentaCrm[]> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CRM_SPREADSHEET_ID,
    range: `${HOJA}!A2:M`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const out: VentaCrm[] = [];
  for (const row of (res.data.values || []) as unknown[][]) {
    const nombre = String(row?.[0] ?? '').trim();
    const monto = Number(row?.[11]) || 0;
    if (!nombre || monto < montoMinimo) continue;

    // El mes es la fecha mas confiable: el CRM no anota el dia del pago.
    // Si falta, caemos a la fecha de agenda.
    const fecha = fechaDeSerial(row?.[1]) || fechaDeSerial(row?.[2]);
    if (!fecha) continue;

    out.push({
      nombre,
      monto,
      fecha,
      restante: Number(row?.[12]) || 0,
      programa: String(row?.[6] ?? '').trim(),
    });
  }
  return out;
}

/** Normaliza un nombre a palabras comparables: sin acentos, sin signos. */
export function palabrasDe(nombre: string): string[] {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 3);
}

/**
 * A que alumno corresponde una venta.
 *
 * Se exige que compartan DOS palabras de mas de 3 letras y que haya un solo
 * candidato. Con una sola palabra "Daniel" matchearia con cuatro personas
 * distintas, y atribuirle la plata a quien no es rompe la comision.
 *
 * Devuelve null cuando no hay match o hay varios: esos casos se muestran
 * aparte para resolverlos a mano, no se adivinan.
 */
export function alumnoDeLaVenta(
  nombreCrm: string,
  alumnos: { id: string; nombre: string | null }[],
): string | null {
  const tv = palabrasDe(nombreCrm);
  if (tv.length === 0) return null;
  const cand = alumnos.filter((u) => {
    const tu = palabrasDe(u.nombre || '');
    return tu.filter((t) => tv.includes(t)).length >= 2;
  });
  return cand.length === 1 ? cand[0].id : null;
}

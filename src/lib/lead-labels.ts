// Mapeo central de los `value` que guarda el quiz a su texto legible.
// Lo usan: el panel de admin (/admin/agendas) y el mensaje de WhatsApp que
// notifica al coach.

export const FORTALEZA_LABEL: Record<string, string> = {
  fuerza: 'Fuerza / potencia',
  cardio: 'Resistencia / cardio',
  flexibilidad: 'Flexibilidad / movilidad',
  velocidad: 'Velocidad / explosividad',
};

export const LIMITACION_LABEL: Record<string, string> = {
  cardio: 'Me canso rápido — falta resistencia',
  movilidad: 'Me cuesta moverme / desplazarme',
  flexibilidad: 'Me falta flexibilidad',
  coordinacion: 'Me cuesta coordinar movimientos',
  mental: 'Mental — confianza, foco',
};

export const ESTADO_LABEL: Record<string, string> = {
  estancado: 'Entreno, pero mi nivel está estancado hace tiempo',
  noaplico: 'Me cuesta aplicar en lucha lo que entreno',
  improviso: 'Improviso y no tengo una estrategia clara',
  inconsistente: 'Algunos días rindo bien, pero no soy consistente',
  canso: 'Me canso rápido y mi nivel baja en los sparrings',
  cuerpo: 'Mi cuerpo ya no responde igual y tengo que adaptar mi juego',
};

export const VISION_LABEL: Record<string, string> = {
  claridad: 'Tener un juego claro donde sé qué hacer en cada situación',
  ritmo: 'Poder imponer mi ritmo y no depender del rival',
  estrategia: 'Dejar de improvisar y empezar a luchar con estrategia',
  solidez: 'Sentirme sólido tanto atacando como defendiendo',
};

export const COMPROMISO_LABEL: Record<string, string> = {
  serio: 'Quiero ordenar mi juego en serio y subir de nivel',
  moderado: 'Quiero mejorar, pero sin tanta exigencia',
  viendo: 'Solo estoy viendo / no busco nada puntual',
};

export const URGENCIA_LABEL: Record<string, string> = {
  si: 'Sí, si me cierra, quisiera avanzar',
  depende: 'Me interesa, pero necesito evaluarlo bien',
  no: 'No, por ahora solo estoy viendo',
};

export interface LeadRow {
  id: string;
  session_id: string;
  instagram: string | null;
  ocupacion: string | null;
  fortaleza: string | null;
  limitacion: string | null;
  estado: string | null;
  vision: string | null;
  compromiso: string | null;
  urgencia: string | null;
  experiencia: string | null;
  telefono: string | null;
  pais: string | null;
  nombre: string | null;
  email: string | null;
  scheduled_at: string | null;
  calendly_event_uri: string | null;
  disqualified: boolean;
  booked: boolean;
  user_agent: string | null;
  referrer: string | null;
  created_at: string;
}

/** Convierte el teléfono guardado (`+5491166518801`) a sólo dígitos para wa.me. */
export function phoneToWaMe(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
}

/** Bandera de país a partir del prefijo guardado (sin "+"). */
const COUNTRY_FLAG: Record<string, string> = {
  '54': '🇦🇷',
  '591': '🇧🇴',
  '55': '🇧🇷',
  '56': '🇨🇱',
  '57': '🇨🇴',
  '506': '🇨🇷',
  '53': '🇨🇺',
  '1809': '🇩🇴',
  '593': '🇪🇨',
  '503': '🇸🇻',
  '34': '🇪🇸',
  '1': '🇺🇸',
  '502': '🇬🇹',
  '504': '🇭🇳',
  '52': '🇲🇽',
  '505': '🇳🇮',
  '507': '🇵🇦',
  '595': '🇵🇾',
  '51': '🇵🇪',
  '1787': '🇵🇷',
  '598': '🇺🇾',
  '58': '🇻🇪',
};

export function flagFor(pais: string | null | undefined): string {
  if (!pais) return '🌐';
  return COUNTRY_FLAG[pais] || '🌐';
}

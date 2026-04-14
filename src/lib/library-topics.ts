/**
 * Lightweight topic classifier for journal entries. Pure regex — no AI, no
 * API calls. Runs on every GET /api/library, and every keystroke on the
 * library search.
 *
 * The order matters: we take the first matching topic. More specific should
 * come before generic (e.g. 'cross grip' before 'guardia').
 */

export type LibraryTopic =
  | 'guardia'
  | 'pasaje'
  | 'montada'
  | 'espalda'
  | 'costado'
  | 'submission'
  | 'defensa'
  | 'takedown'
  | 'competencia'
  | 'otro';

interface TopicRule {
  topic: LibraryTopic;
  label: string;
  keywords: RegExp;
}

// Word boundaries on both sides so 'de la riva' matches but 'guardia' doesn't
// light up when the text says 'resguardia'.
const KW = (words: string[]) =>
  new RegExp(`\\b(${words.map((w) => w.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'i');

const RULES: TopicRule[] = [
  {
    topic: 'submission',
    label: 'Submissions',
    keywords: KW([
      'kimura',
      'armbar',
      'triangulo',
      'triangle',
      'mataleon',
      'mata leon',
      'rear naked',
      'rnc',
      'americana',
      'omoplata',
      'ezequiel',
      'guillotina',
      'guillotine',
      'darce',
      "d'arce",
      'anaconda',
      'estrangulacion',
      'strangle',
      'heel hook',
      'kneebar',
      'toe hold',
      'ashi garami',
    ]),
  },
  {
    topic: 'pasaje',
    label: 'Pasajes',
    keywords: KW([
      'pasaje',
      'pasar',
      'pasada',
      'passing',
      'toreo',
      '100 kg',
      '100kg',
      'smash pass',
      'double under',
      'leg drag',
      'knee slice',
      'stack pass',
      'long step',
      'over under',
    ]),
  },
  {
    topic: 'guardia',
    label: 'Guardia',
    keywords: KW([
      'guardia',
      'de la riva',
      'dlr',
      'reverse de la riva',
      'rdlr',
      'x guard',
      'butterfly',
      'mariposa',
      'cross grip',
      'gola manga',
      'spider',
      'lasso',
      'half guard',
      'media guardia',
      'closed guard',
      'guardia cerrada',
      'k guard',
      'z guard',
      '50/50',
      'single leg x',
      'rubber guard',
    ]),
  },
  {
    topic: 'montada',
    label: 'Montada',
    keywords: KW(['montada', 'mount', 's-mount', 'technical mount']),
  },
  {
    topic: 'espalda',
    label: 'Espalda',
    keywords: KW(['espalda', 'back control', 'back take', 'toma de espalda']),
  },
  {
    topic: 'costado',
    label: 'Side / 100kg',
    keywords: KW(['costado', 'side control', 'north south', 'kesa', 'scarf hold']),
  },
  {
    topic: 'defensa',
    label: 'Defensa / Escapes',
    keywords: KW([
      'escape',
      'escapar',
      'defensa',
      'defender',
      'defense',
      'bridge',
      'shrimp',
      'bridge and roll',
    ]),
  },
  {
    topic: 'takedown',
    label: 'Takedowns',
    keywords: KW([
      'takedown',
      'derribo',
      'double leg',
      'single leg',
      'uchi mata',
      'osoto',
      'o soto gari',
      'sasae',
      'seoi nage',
      'ippon',
      'lucha',
      'wrestling',
      'judo',
    ]),
  },
  {
    topic: 'competencia',
    label: 'Competencia',
    keywords: KW([
      'competencia',
      'competition',
      'torneo',
      'tournament',
      'ibjjf',
      'campeonato',
      'podio',
      'medalla',
      'final',
      'semifinal',
    ]),
  },
];

export function classifyTopic(text: string): LibraryTopic {
  if (!text) return 'otro';
  for (const rule of RULES) {
    if (rule.keywords.test(text)) return rule.topic;
  }
  return 'otro';
}

export const TOPIC_LABELS: Record<LibraryTopic, string> = {
  submission: 'Submissions',
  pasaje: 'Pasajes',
  guardia: 'Guardia',
  montada: 'Montada',
  espalda: 'Espalda',
  costado: 'Side / 100kg',
  defensa: 'Defensa / Escapes',
  takedown: 'Takedowns',
  competencia: 'Competencia',
  otro: 'Otros',
};

export const TOPIC_TONE: Record<LibraryTopic, string> = {
  submission: 'bg-red-500/10 border-red-500/25 text-red-400',
  pasaje: 'bg-orange-500/10 border-orange-500/25 text-orange-400',
  guardia: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
  montada: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
  espalda: 'bg-pink-500/10 border-pink-500/25 text-pink-400',
  costado: 'bg-teal-500/10 border-teal-500/25 text-teal-400',
  defensa: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  takedown: 'bg-green-500/10 border-green-500/25 text-green-400',
  competencia: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
  otro: 'bg-white/5 border-white/10 text-jjl-muted',
};

const URL_REGEX = /https?:\/\/[^\s]+/g;

export function extractLinks(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

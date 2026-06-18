// Data de los arquetipos del quiz "¿A qué luchador te parecés?".
// La data técnica (fortaleza/guardia/pasaje/dolor típico) fue dictada por
// Ignacio (coach JJL) — no inventar. Si querés cambiarla, este es el lugar.
//
// Cada arquetipo tiene asignada una planilla del programa de 6 meses para
// el matching interno (el lead no la ve en la ficha, la usa el setter cuando
// atiende el DM).

export type ArquetipoId = 'marcelo' | 'gordon' | 'buchecha' | 'bernardo' | 'cobrinha';
export type PlanillaId = 'livianos' | 'medios' | 'simbio' | 'atleticos';

export interface Arquetipo {
  id: ArquetipoId;
  nombre: string;          // "Marcelo Garcia"
  apodo: string;           // "El acrobata movil"
  planilla: PlanillaId;    // recomendación interna
  fortaleza: string;       // "Drilling obsesivo + movilidad"
  mejorGuardia: string;    // "X-Guard"
  mejorPasaje: string;     // "Toreo + control de manga"
  loQueCuesta: string;     // "Defender contra pesados que lo aplastan"
}

export const ARQUETIPOS: Record<ArquetipoId, Arquetipo> = {
  marcelo: {
    id: 'marcelo',
    nombre: 'Marcelo Garcia',
    apodo: 'El acrobata movil',
    planilla: 'medios',
    fortaleza: 'Drilling obsesivo + movilidad',
    mejorGuardia: 'X-Guard',
    mejorPasaje: 'Toreo + control de manga',
    loQueCuesta: 'Defender contra pesados que lo aplastan',
  },
  gordon: {
    id: 'gordon',
    nombre: 'Gordon Ryan',
    apodo: 'El sistematico implacable',
    planilla: 'atleticos',
    fortaleza: 'Control sistematico + presion',
    mejorGuardia: 'Ashi Garami / Mariposa',
    mejorPasaje: 'Media guardia con presion',
    loQueCuesta: 'Rivales explosivos que fuerzan scrambles',
  },
  buchecha: {
    id: 'buchecha',
    nombre: 'Buchecha',
    apodo: 'El atleta bruto',
    planilla: 'atleticos',
    fortaleza: 'Atleticismo + presion',
    mejorGuardia: 'Sit-Up Guard / Media guardia',
    mejorPasaje: 'Knee Cut + presion',
    loQueCuesta: 'Juegos modernos de mucho enredo y lapel',
  },
  bernardo: {
    id: 'bernardo',
    nombre: 'Bernardo Faria',
    apodo: 'El paciente desde abajo',
    planilla: 'simbio',
    fortaleza: 'Simplicidad extrema + eficiencia',
    mejorGuardia: 'Media guardia profunda',
    mejorPasaje: 'Over-Under Pass',
    loQueCuesta: 'Rivales muy moviles que evitan el contacto',
  },
  cobrinha: {
    id: 'cobrinha',
    nombre: 'Cobrinha',
    apodo: 'El maestro del timing',
    planilla: 'livianos',
    fortaleza: 'Timing + movilidad + angulos',
    mejorGuardia: 'DLR / X-Guard',
    mejorPasaje: 'Leg Drag + Toreando',
    loQueCuesta: 'Rivales mucho mas pesados que frenan el ritmo',
  },
};

// ── Las 7 preguntas + scoring ────────────────────────────────────────────
// Cada respuesta suma puntos a 1-3 arquetipos. Pesos calibrados para
// que ningún arquetipo domine en exceso por una sola pregunta.

export interface QuizOption {
  value: string;
  label: string;
  /** Puntos por arquetipo. Si el arquetipo no aparece → 0. */
  scores: Partial<Record<ArquetipoId, number>>;
}

export interface QuizQuestion {
  id: string;
  pregunta: string;
  subtitulo?: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'peso',
    pregunta: 'Tu peso aproximado',
    subtitulo: 'Dependiendo tu categoria, hay luchadores que se parecen mas a tu estilo',
    options: [
      { value: 'pluma',   label: 'Pluma (hasta 70kg)',     scores: { cobrinha: 3, marcelo: 2 } },
      { value: 'medio',   label: 'Medio (70 a 88kg)',      scores: { marcelo: 3, cobrinha: 2, gordon: 1 } },
      { value: 'pesado',  label: 'Pesado (88 a 100kg)',    scores: { gordon: 2, buchecha: 2, bernardo: 2 } },
      { value: 'superpesado', label: 'Super pesado (+100kg)', scores: { gordon: 3, buchecha: 3, bernardo: 3 } },
    ],
  },
  {
    id: 'fisico',
    pregunta: 'Como describirias tu fisico',
    options: [
      { value: 'explosivo', label: 'Explosivo, mucha potencia corta', scores: { buchecha: 3, cobrinha: 2, marcelo: 1 } },
      { value: 'resistente', label: 'Resistente, no me canso', scores: { gordon: 3, bernardo: 3 } },
      { value: 'fuerte', label: 'Fuerte, hago pesar mi peso', scores: { gordon: 2, buchecha: 2, bernardo: 3 } },
      { value: 'flexible', label: 'Flexible y rapido', scores: { marcelo: 3, cobrinha: 2 } },
    ],
  },
  {
    id: 'estilo',
    pregunta: 'Cuando luchas libre, que haces mas',
    options: [
      { value: 'arriba', label: 'Siempre voy arriba, busco pasar', scores: { gordon: 3, buchecha: 3, bernardo: 1 } },
      { value: 'abajo', label: 'Me siento comodo abajo, jugando guardia', scores: { marcelo: 3, bernardo: 3, cobrinha: 2 } },
      { value: 'finalizar', label: 'Busco terminar rapido, voy directo al sub', scores: { buchecha: 2, cobrinha: 1, gordon: 1 } },
      { value: 'improviso', label: 'Voy probando, no tengo un patron fijo', scores: { marcelo: 1, cobrinha: 1 } },
    ],
  },
  {
    id: 'posicion',
    pregunta: 'Desde donde te sentis mas peligroso',
    options: [
      { value: 'guardia', label: 'Guardia', scores: { marcelo: 3, cobrinha: 2, bernardo: 2 } },
      { value: 'pasaje', label: 'Pasaje', scores: { gordon: 3, buchecha: 3, bernardo: 2, cobrinha: 1 } },
      { value: 'montada', label: 'Montada', scores: { buchecha: 2, gordon: 2 } },
      { value: 'espalda', label: 'Espalda', scores: { gordon: 3, buchecha: 1 } },
      { value: 'sub-abajo', label: 'Sub abajo', scores: { marcelo: 2, cobrinha: 2, bernardo: 2 } },
    ],
  },
  {
    id: 'finalizacion',
    pregunta: 'Tu finalizacion predilecta',
    options: [
      { value: 'estrangulacion', label: 'Estrangulacion (gola, ezekiel...)', scores: { gordon: 2, bernardo: 2, buchecha: 1 } },
      { value: 'palanca', label: 'Palanca de brazo', scores: { gordon: 2, marcelo: 2, buchecha: 1 } },
      { value: 'leglock', label: 'Leg lock (ashi, heelhook)', scores: { gordon: 3, cobrinha: 1 } },
      { value: 'mataleon', label: 'Mata leon', scores: { gordon: 3, buchecha: 2 } },
      { value: 'triangulo', label: 'Triangulo', scores: { marcelo: 3, cobrinha: 2, bernardo: 1 } },
    ],
  },
  {
    id: 'dolor',
    pregunta: 'Lo que mas te cuesta hoy',
    subtitulo: 'Esto es clave para que tu instructor sepa por donde empezar',
    options: [
      { value: 'me-aplastan', label: 'Me agarran abajo y no puedo salir', scores: { marcelo: 2, cobrinha: 2 } },
      { value: 'no-paso', label: 'No logro pasar la guardia', scores: { gordon: 2, buchecha: 2 } },
      { value: 'no-defiendo', label: 'Me cuesta defender posiciones', scores: { bernardo: 2, cobrinha: 1 } },
      { value: 'no-finalizo', label: 'Intento finalizar y no la cierro', scores: { bernardo: 2, gordon: 1 } },
    ],
  },
  {
    id: 'vision',
    pregunta: 'Si tu juego mejora, que cambia en tu vida',
    subtitulo: 'Contestame con tus palabras (1-2 lineas)',
    options: [], // texto libre — no scorea
  },
];

// ── Scoring ──────────────────────────────────────────────────────────────

export interface QuizAnswers {
  peso: string;
  fisico: string;
  estilo: string;
  posicion: string;
  finalizacion: string;
  dolor: string;
  vision: string;
}

export interface MatchResult {
  winner: ArquetipoId;
  matchPct: number;         // 75-95
  scores: Record<ArquetipoId, number>;
}

export function calculateMatch(answers: Partial<QuizAnswers>): MatchResult {
  const scores: Record<ArquetipoId, number> = {
    marcelo: 0, gordon: 0, buchecha: 0, bernardo: 0, cobrinha: 0,
  };

  for (const q of QUIZ_QUESTIONS) {
    const ans = answers[q.id as keyof QuizAnswers];
    if (!ans || q.options.length === 0) continue;
    const opt = q.options.find((o) => o.value === ans);
    if (!opt) continue;
    for (const [arq, pts] of Object.entries(opt.scores)) {
      scores[arq as ArquetipoId] += pts as number;
    }
  }

  // Winner = el de más puntos. Empate → primer aparición (orden ARQUETIPOS).
  const entries = Object.entries(scores) as Array<[ArquetipoId, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const winner = entries[0][0];
  const winnerScore = entries[0][1];

  // Max teórico — sumamos el max por pregunta para el ganador
  let maxPossible = 0;
  for (const q of QUIZ_QUESTIONS) {
    if (q.options.length === 0) continue;
    const maxThisQ = Math.max(...q.options.map((o) => o.scores[winner] ?? 0));
    maxPossible += maxThisQ;
  }

  // % match: floor 75% para que ningún resultado se sienta "pobre".
  const raw = maxPossible > 0 ? (winnerScore / maxPossible) * 100 : 80;
  const matchPct = Math.max(75, Math.min(95, Math.round(raw)));

  return { winner, matchPct, scores };
}

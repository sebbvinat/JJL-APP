// Data de los arquetipos del quiz "¿A qué luchador te parecés?".
// La data técnica (fortaleza/guardia/pasaje/dolor típico) fue dictada por
// Guido (coach JJL) — no inventar. Si querés cambiarla, este es el lugar.
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
  /** Avatar circular en /public/arquetipos/<id>.png. Si no existe, la ficha
   *  cae a las iniciales — nunca se rompe. Generar con scripts/avatar-arquetipo.py */
  foto?: string;
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
    foto: '/arquetipos/gordon.png',
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
    id: 'frecuencia',
    pregunta: '¿Cuántas veces por semana entrenás?',
    subtitulo: 'De esto depende qué juego te conviene, mucho más que tu biotipo',
    options: [
      { value: '1-2', label: '1 o 2 veces',   scores: { bernardo: 3, cobrinha: 1 } },
      { value: '3',   label: '3 veces',        scores: { bernardo: 2, marcelo: 1, cobrinha: 1 } },
      { value: '4-5', label: '4 o 5 veces',    scores: { marcelo: 2, gordon: 1, cobrinha: 1 } },
      { value: '6+',  label: '6 o más',        scores: { gordon: 3, buchecha: 2, marcelo: 1 } },
    ],
  },
  {
    id: 'antiguedad',
    pregunta: '¿Hace cuánto entrenás jiu-jitsu?',
    options: [
      { value: '-1',  label: 'Menos de un año',  scores: { bernardo: 2 } },
      { value: '1-3', label: 'Entre 1 y 3 años', scores: { bernardo: 1, buchecha: 1 } },
      { value: '3-7', label: 'Entre 3 y 7 años', scores: { marcelo: 1, cobrinha: 1, gordon: 1 } },
      { value: '7+',  label: 'Más de 7 años',    scores: { marcelo: 2, cobrinha: 2, gordon: 1 } },
    ],
  },
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
  frecuencia: string;
  antiguedad: string;
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

// ── LA BRECHA — "lo que te separa" ───────────────────────────────────────
// El resultado solo con el arquetipo es un halago: el lead sale contento y
// no pasa nada. Esta parte cruza lo que el lead DIJO (dolor, frecuencia,
// antigüedad) con la debilidad conocida del arquetipo.
//
// REGLA: nada de biomecánica inventada. La brecha se explica por VOLUMEN de
// entrenamiento y por DISEÑO de juego — que es la tesis de JJL y es honesta.

export const DOLOR_LABEL: Record<string, string> = {
  'me-aplastan': 'te agarran abajo y no podés salir',
  'no-paso': 'no lográs pasar la guardia',
  'no-defiendo': 'te cuesta defender posiciones',
  'no-finalizo': 'intentás finalizar y no la cerrás',
};

const FRECUENCIA_LABEL: Record<string, string> = {
  '1-2': '1 o 2 veces por semana',
  '3': '3 veces por semana',
  '4-5': '4 o 5 veces por semana',
  '6+': '6 o más veces por semana',
};

/** Entrenos semanales aproximados de un profesional a tiempo completo. */
const VOLUMEN_PRO = '8 a 12 veces por semana';

export interface BrechaBloque {
  titulo: string;
  texto: string;
}

/**
 * Devuelve los 2 bloques de "lo que te separa".
 * Bloque 1 = el problema (el suyo vs el del arquetipo).
 * Bloque 2 = por qué copiarle el juego entero no funciona.
 */
export function construirBrecha(
  arq: Arquetipo,
  answers: Partial<QuizAnswers>,
): BrechaBloque[] {
  const bloques: BrechaBloque[] = [];

  // ── 1 · Mismo problema, distinta respuesta ─────────────────────────────
  const dolor = DOLOR_LABEL[answers.dolor ?? ''] ?? '';
  if (dolor) {
    bloques.push({
      titulo: 'No es que él no tenga tu problema',
      texto:
        `A ${arq.nombre} también le cuesta ${arq.loQueCuesta.toLowerCase()}. ` +
        `Y vos dijiste que hoy ${dolor}. ` +
        `La diferencia no es el problema: es que él tiene una respuesta armada y entrenada para cuando aparece. Vos todavía no.`,
    });
  }

  // ── 2 · La brecha de volumen ───────────────────────────────────────────
  const frec = answers.frecuencia ?? '';
  const frecLabel = FRECUENCIA_LABEL[frec] ?? '';
  if (frecLabel) {
    const pocas = frec === '1-2' || frec === '3';
    bloques.push({
      titulo: pocas ? 'Su juego no está hecho para tu semana' : 'El volumen igual no alcanza',
      texto: pocas
        ? `${arq.nombre} entrena ${VOLUMEN_PRO}. Vos, ${frecLabel}. ` +
          `Su juego está diseñado para ese volumen: necesita repeticiones que vos no tenés cuándo hacer. ` +
          `Copiarlo entero es la forma más rápida de estancarte. Lo que sirve es la versión de ese juego que entra en tu semana.`
        : `${arq.nombre} entrena ${VOLUMEN_PRO}. Vos, ${frecLabel}. ` +
          `Estás cerca en horas, pero la diferencia no es cuánto entrena: es que cada entrenamiento suyo tiene un objetivo. ` +
          `El volumen sin dirección no cierra esa brecha.`,
    });
  }

  // ── 3 · Antigüedad: cambia CUÁL es el cuello de botella ────────────────
  const ant = answers.antiguedad ?? '';
  if (ant === '3-7' || ant === '7+') {
    bloques.push({
      titulo: 'Probablemente no te falten técnicas',
      texto:
        `Con los años que llevás, lo más común no es que te falte conocimiento: es que tengas técnicas sueltas que nunca se conectaron entre sí. ` +
        `El próximo salto casi nunca viene de aprender la número veintiuno.`,
    });
  } else if (ant === '-1') {
    bloques.push({
      titulo: 'Estás en el mejor momento para elegir',
      texto:
        `Todavía no acumulaste técnicas que no vas a usar. Si elegís bien ahora, te ahorrás años de dar vueltas.`,
    });
  }

  return bloques;
}

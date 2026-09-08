// Data de los arquetipos del quiz "¿A qué luchador te parecés?".
// La data técnica (fortaleza/guardia/pasaje/dolor típico) fue dictada por
// Guido (coach JJL) — no inventar. Si querés cambiarla, este es el lugar.
//
// Cada arquetipo tiene asignada una planilla del programa de 6 meses para
// el matching interno (el lead no la ve en la ficha, la usa el setter cuando
// atiende el DM).

export type ArquetipoId =
  | 'marcelo' | 'gordon' | 'buchecha' | 'bernardo' | 'cobrinha' | 'roger' | 'adam';
export type PlanillaId = 'livianos' | 'medios' | 'simbio' | 'atleticos';

export interface Arquetipo {
  id: ArquetipoId;
  nombre: string;          // "Marcelo Garcia"
  apodo: string;           // "El acrobata movil"
  planilla: PlanillaId;    // recomendacion interna
  fortaleza: string;       // "Drilling obsesivo + movilidad"
  mejorGuardia: string;    // "X-Guard"
  mejorPasaje: string;     // "Toreo + control de manga"
  loQueCuesta: string;     // "Defender contra pesados que lo aplastan"
  /** Avatar circular en /public/arquetipos/<id>.png. Si no existe, la ficha
   *  cae a las iniciales - nunca se rompe. Generar con scripts/avatar-arquetipo.py */
  foto?: string;
  /** Atribucion obligatoria de la foto, si la licencia la pide (CC BY / BY-SA).
   *  Se muestra al pie de la ficha. Las de dominio publico no llevan.
   *  Ver public/arquetipos/CREDITOS.md */
  credito?: string;
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
    foto: '/arquetipos/marcelo.webp', // dominio publico, no necesita credito
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
    foto: '/arquetipos/gordon.webp',
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
    foto: '/arquetipos/buchecha.webp',
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
    foto: '/arquetipos/bernardo.webp',
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
    foto: '/arquetipos/cobrinha.webp',
    credito: 'Foto: Dkaivani / Wikimedia Commons (CC BY-SA 3.0)',
  },
  // NUEVOS (sept 2026). Cubren dos perfiles que antes caian mal:
  //   - el largo que juega arriba y simple  -> antes le daba Gordon
  //   - el fuerte que juega abajo de mariposa -> antes le daba Bernardo
  // OJO: la data tecnica de estos dos la escribi yo con lo publico de cada
  // luchador. Guido la tiene que confirmar como confirmo la de los otros 5.
  roger: {
    id: 'roger',
    nombre: 'Roger Gracie',
    apodo: 'El gigante de lo basico',
    planilla: 'atleticos',
    fortaleza: 'Fundamentos perfectos + presion',
    mejorGuardia: 'Guardia cerrada',
    mejorPasaje: 'Pasaje a presion cerrando espacios',
    loQueCuesta: 'Juegos de piernas modernos y enredos rapidos',
    foto: '/arquetipos/roger.webp',
  },
  adam: {
    id: 'adam',
    nombre: 'Adam Wardzinski',
    apodo: 'El rey de la mariposa',
    planilla: 'simbio',
    fortaleza: 'Mariposa + fuerza de empuje',
    mejorGuardia: 'Mariposa (butterfly)',
    mejorPasaje: 'Over-Under + Dog Fight',
    loQueCuesta: 'Rivales largos que juegan a distancia y no lo dejan enganchar',
    foto: '/arquetipos/adam.webp',
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
      // "No estoy entrenando" no es un descarte: es el que vuelve despues de
      // una lesion o un parate, y necesita el juego mas simple posible.
      { value: 'no-entreno', label: 'Ahora no estoy entrenando', scores: { bernardo: 3, roger: 3 } },
      { value: '1-2', label: '1 o 2 veces',  scores: { bernardo: 3, roger: 2, adam: 1 } },
      { value: '3',   label: '3 veces',      scores: { bernardo: 2, roger: 2, adam: 2, marcelo: 1 } },
      { value: '4-5', label: '4 o 5 veces',  scores: { adam: 3, marcelo: 2, cobrinha: 2, buchecha: 2 } },
      { value: '6+',  label: '6 o más',      scores: { gordon: 3, buchecha: 3, cobrinha: 2, marcelo: 1 } },
    ],
  },
  {
    id: 'antiguedad',
    pregunta: '¿Hace cuánto entrenás jiu-jitsu?',
    options: [
      { value: '-1',  label: 'Menos de un año',  scores: { roger: 3, bernardo: 2 } },
      { value: '1-3', label: 'Entre 1 y 3 años', scores: { buchecha: 3, bernardo: 2, adam: 2, roger: 1 } },
      { value: '3-7', label: 'Entre 3 y 7 años', scores: { marcelo: 2, gordon: 2, adam: 2, cobrinha: 1 } },
      { value: '7+',  label: 'Más de 7 años',    scores: { cobrinha: 3, marcelo: 2, gordon: 2 } },
    ],
  },
  {
    id: 'peso',
    pregunta: 'Tu peso aproximado',
    subtitulo: 'Dependiendo tu categoria, hay luchadores que se parecen mas a tu estilo',
    options: [
      { value: 'pluma',   label: 'Pluma (hasta 70kg)',  scores: { cobrinha: 4, marcelo: 2 } },
      { value: 'medio',   label: 'Medio (70 a 88kg)',   scores: { marcelo: 3, cobrinha: 2, adam: 2, gordon: 1 } },
      { value: 'pesado',  label: 'Pesado (88 a 100kg)', scores: { adam: 3, buchecha: 3, gordon: 2, bernardo: 2, roger: 2 } },
      { value: 'superpesado', label: 'Super pesado (+100kg)', scores: { roger: 3, bernardo: 3, buchecha: 3, gordon: 2 } },
    ],
  },
  {
    id: 'fisico',
    pregunta: 'Como describirias tu fisico',
    options: [
      { value: 'explosivo',  label: 'Explosivo, mucha potencia corta',   scores: { buchecha: 4, cobrinha: 3, adam: 1 } },
      { value: 'resistente', label: 'Resistente, no me canso',           scores: { gordon: 3, bernardo: 3, marcelo: 1 } },
      { value: 'fuerte',     label: 'Fuerte, hago pesar mi peso',        scores: { adam: 4, buchecha: 2, bernardo: 2, gordon: 1 } },
      { value: 'flexible',   label: 'Flexible y rapido',                 scores: { marcelo: 3, cobrinha: 2 } },
      { value: 'largo',      label: 'Largo, aprovecho la distancia',     scores: { roger: 4, marcelo: 1, gordon: 1 } },
      // El que no sabe describirse no puede salir castigado por ser honesto:
      // suma 1 a todos, o sea deja que decidan las otras 7 preguntas.
      { value: 'no-se',      label: 'No sabria como describirlo',
        scores: { marcelo: 1, gordon: 1, buchecha: 1, bernardo: 1, cobrinha: 1, roger: 1, adam: 1 } },
    ],
  },
  {
    id: 'estilo',
    pregunta: 'Cuando luchas libre, que haces mas',
    options: [
      { value: 'arriba',    label: 'Siempre voy arriba, busco pasar',        scores: { gordon: 3, buchecha: 3, roger: 3 } },
      { value: 'abajo',     label: 'Me siento comodo abajo, jugando guardia', scores: { marcelo: 3, bernardo: 3, adam: 3, cobrinha: 2 } },
      { value: 'finalizar', label: 'Busco terminar rapido, voy directo al sub', scores: { buchecha: 2, cobrinha: 2, gordon: 1 } },
      { value: 'reacciono', label: 'Espero lo que propone el rival y reacciono', scores: { bernardo: 2, roger: 1, marcelo: 1 } },
      { value: 'improviso', label: 'Voy probando, no tengo un patron fijo',  scores: { cobrinha: 2, adam: 2, marcelo: 1 } },
    ],
  },
  {
    id: 'posicion',
    pregunta: 'Desde donde te sentis mas peligroso',
    options: [
      { value: 'guardia',       label: 'Desde la guardia',                    scores: { adam: 4, marcelo: 3, cobrinha: 3, bernardo: 2 } },
      // Partir el pasaje en larga/corta es lo que separa a Cobrinha y Marcelo
      // (toreo, distancia) de Buchecha, Bernardo y Roger (presion, espacios
      // cerrados). Con "pasaje" a secas los tres primeros casi no salian.
      { value: 'pasaje-largo', label: 'Pasando a distancia larga, toreando',  scores: { cobrinha: 2, marcelo: 2, gordon: 1 } },
      { value: 'pasaje-corto', label: 'Pasando a distancia corta, presionando', scores: { gordon: 3, buchecha: 3, bernardo: 3, roger: 2, adam: 1 } },
      { value: 'montada',      label: 'En posiciones dominantes arriba',      scores: { roger: 3, buchecha: 3 } },
      { value: 'espalda',      label: 'En la espalda',                        scores: { gordon: 3, marcelo: 3 } },
      { value: 'sub-abajo',    label: 'Atacando subs desde abajo',            scores: { marcelo: 2, cobrinha: 2, bernardo: 2, adam: 2 } },
    ],
  },
  {
    id: 'finalizacion',
    pregunta: 'Tu finalizacion predilecta',
    options: [
      { value: 'estrangulacion', label: 'Estrangulacion (gola, ezekiel...)', scores: { roger: 3, bernardo: 2, gordon: 1, adam: 1 } },
      { value: 'palanca',        label: 'Palanca de brazo',                  scores: { adam: 3, buchecha: 3, marcelo: 1, roger: 1 } },
      { value: 'leglock',        label: 'Leg lock (ashi, heelhook)',         scores: { gordon: 4, cobrinha: 1, adam: 1 } },
      { value: 'mataleon',       label: 'Mata leon',                         scores: { marcelo: 3, gordon: 2, buchecha: 2 } },
      { value: 'triangulo',      label: 'Triangulo',                         scores: { cobrinha: 4, marcelo: 2, bernardo: 1 } },
    ],
  },
  {
    id: 'dolor',
    pregunta: 'Lo que mas te cuesta hoy',
    subtitulo: 'Esto es clave para que tu instructor sepa por donde empezar',
    options: [
      { value: 'me-aplastan', label: 'Me agarran abajo y no puedo salir',  scores: { marcelo: 2, cobrinha: 2, adam: 1 } },
      { value: 'no-paso',     label: 'No logro pasar la guardia',          scores: { buchecha: 3, gordon: 2, roger: 1 } },
      { value: 'no-defiendo', label: 'Me cuesta defender posiciones',      scores: { bernardo: 2, roger: 2 } },
      { value: 'no-finalizo', label: 'Intento finalizar y no la cierro',   scores: { adam: 2, bernardo: 1, gordon: 1, roger: 1 } },
      { value: 'no-se-que-buscar', label: 'No se que buscar durante la lucha', scores: { roger: 2, bernardo: 2, marcelo: 1 } },
    ],
  },
  {
    id: 'vision',
    pregunta: 'Si tu juego mejora, que cambia en tu vida',
    subtitulo: 'Contestame con tus palabras (1-2 lineas)',
    options: [], // texto libre - no scorea
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
  // Derivado de ARQUETIPOS y no escrito a mano: al sumar Roger y Adam esta
  // lista quedaba vieja y los arquetipos nuevos nunca podian ganar.
  const scores = Object.fromEntries(
    (Object.keys(ARQUETIPOS) as ArquetipoId[]).map((a) => [a, 0]),
  ) as Record<ArquetipoId, number>;

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
  'no-se-que-buscar': 'no sabés qué buscar durante la lucha',
};

const FRECUENCIA_LABEL: Record<string, string> = {
  'no-entreno': 'hoy no estás entrenando',
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

  // El que no esta entrenando necesita su propio bloque: caia en el de
  // "estas cerca en horas", que para el no tiene ningun sentido.
  if (frec === 'no-entreno') {
    bloques.push({
      titulo: 'Lo primero es volver, no elegir juego',
      texto:
        `${arq.nombre} entrena ${VOLUMEN_PRO}. Vos hoy no estás entrenando, y eso no es un detalle: ` +
        `ningún juego funciona sin repeticiones. ` +
        `La buena noticia es que volver con un plan armado es mucho más rápido que empezar de cero, ` +
        `y lo que hagas en las primeras semanas de vuelta define el resto del año.`,
    });
  } else if (frecLabel) {
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

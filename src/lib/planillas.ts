// Planillas — Training program templates
// Each planilla defines the full 6-month curriculum (Fundamentos + 24 weeks)

export interface PlanillaLesson {
  titulo: string;
  tipo: 'video' | 'reflection';
}

export interface PlanillaWeek {
  semana_numero: number;
  titulo: string;
  lessons: PlanillaLesson[];
}

export interface Planilla {
  id: string;
  nombre: string;
  descripcion: string;
  weeks: PlanillaWeek[];
}

// Helpers
const v = (titulo: string): PlanillaLesson => ({ titulo, tipo: 'video' });
const r = (): PlanillaLesson => ({ titulo: 'Reflexión semanal', tipo: 'reflection' });

// =============================================
// SHARED: Fundamentos + Months 1 & 2 (all programs)
// =============================================

const FUNDAMENTOS: PlanillaWeek = {
  semana_numero: 0,
  titulo: 'Fundamentos',
  lessons: [
    v('Llamado a guardia cerrada'),
    v('Apertura de guardia'),
    v('Retención de guardia'),
    v('Concepto de pasaje'),
  ],
};

const SHARED_MONTH_1: PlanillaWeek[] = [
  {
    semana_numero: 1,
    titulo: 'Guardia Cerrada + Toreos I',
    lessons: [
      v('Introducción'),
      v('Guardia Cerrada Conceptos'),
      v('Guardia cerrada: Triángulo'),
      v('Toreos: conceptos'),
      v('Toreos Variante 1'),
      v('Drill 1: Guardia cerrada'),
      v('Drill 2: Toreos'),
      r(),
    ],
  },
  {
    semana_numero: 2,
    titulo: 'Guardia Cerrada + Toreos II',
    lessons: [
      v('Guardia cerrada: Top Lock'),
      v('Toreos Variante 2'),
      v('Drill 1: Toreos'),
      v('Drill 2: Guardia cerrada'),
      r(),
    ],
  },
  {
    semana_numero: 3,
    titulo: 'Guardia Cerrada + Toreos III',
    lessons: [
      v('Guardia cerrada: Toma de espalda'),
      v('Toreos Variante 3'),
      v('Drill 1: Guardia cerrada'),
      v('Drill 2: Toreos'),
      v('Drill de combinación: Guardia cerrada'),
      v('Drill en combinación: Toreos'),
      r(),
    ],
  },
  {
    semana_numero: 4,
    titulo: 'Guardia Cerrada + Toreos IV',
    lessons: [
      v('Guardia cerrada: Flower / Péndulo'),
      v('Toreos Variante 4'),
      v('Drill 1: Guardia cerrada'),
      v('Drill 2: Toreos'),
      v('Específico de guardia cerrada'),
      r(),
    ],
  },
];

const SHARED_MONTH_2: PlanillaWeek[] = [
  {
    semana_numero: 5,
    titulo: '100KG + Kimura',
    lessons: [
      v('Concepto de 100 KG'),
      v('Finalización Kimura'),
      v('Drill 1: Kimura'),
      v('Drill 2: Combinación toreos + Kimura'),
      v('Observaciones finales toreos'),
      v('Específico de toreos'),
      r(),
    ],
  },
  {
    semana_numero: 6,
    titulo: 'Armbar + Guardia Cerrada',
    lessons: [
      v('Finalización Armbar'),
      v('Drill 1: Armbar'),
      v('Drill 2: Combinación toreos + armbar'),
      v('Específico guardia cerrada'),
      r(),
    ],
  },
  {
    semana_numero: 7,
    titulo: 'Escape 100KG I',
    lessons: [
      v('Escape 100 kilos'),
      v('Drill 1: Escape de 100kg'),
      v('Drill 2: Escape + Combinación Guardia cerrada'),
      v('Específico de 100KG'),
      r(),
    ],
  },
  {
    semana_numero: 8,
    titulo: 'Escape 100KG II',
    lessons: [
      v('Escape de 100KG variante 2'),
      v('Drill 1: 100 KG variante 2'),
      v('Drill 2: Drill combinación escape + guardia cerrada'),
      v('Específico de guardia cerrada'),
      r(),
    ],
  },
];

// =============================================
// LIVIANOS — Months 3-6
// =============================================

const LIVIANOS_MONTH_3: PlanillaWeek[] = [
  {
    semana_numero: 9,
    titulo: 'Leg Trap + De la Riva I',
    lessons: [
      v('Conceptos de Leg Trap'),
      v('Conceptos De la Riva'),
      v('Leg Trap variante 1'),
      v('De la Riva variante 1'),
      v('Drill 1: Leg Trap'),
      v('Drill 2: De la Riva'),
      r(),
    ],
  },
  {
    semana_numero: 10,
    titulo: 'Leg Trap + De la Riva II',
    lessons: [
      v('Leg trap variante 2'),
      v('De la Riva variante 2'),
      v('Drill 1: Leg Trap'),
      v('Drill 2: De la Riva'),
      v('Drill en combinación: Leg Trap'),
      r(),
    ],
  },
  {
    semana_numero: 11,
    titulo: 'Leg Trap + De la Riva III',
    lessons: [
      v('Leg Trap variante 3'),
      v('De la Riva variante 3'),
      v('Drill 1: Leg Trap'),
      v('Drill 2: De la Riva'),
      v('Drill en combinación: Leg Trap'),
      v('Específico de DLR'),
      r(),
    ],
  },
  {
    semana_numero: 12,
    titulo: 'Leg Trap + De la Riva IV',
    lessons: [
      v('De la Riva variante 4'),
      v('Leg Trap variante 4'),
      v('Drill 1: De la Riva'),
      v('Drill 2: Leg Trap'),
      v('Juego ecológico: pasaje / guardia'),
      r(),
    ],
  },
];

const LIVIANOS_MONTH_4: PlanillaWeek[] = [
  {
    semana_numero: 13,
    titulo: 'Montada + Triángulo de Brazo',
    lessons: [
      v('Conceptos de montada'),
      v('Finalización Triángulo de Brazo'),
      v('Drill 1: Triángulo de brazo'),
      v('Drill 2: Combinación de pasaje (toreos + leg trap) + triángulo de brazo'),
      v('Juego ecológico: pasaje / guardia'),
      r(),
    ],
  },
  {
    semana_numero: 14,
    titulo: 'Llave de Brazo',
    lessons: [
      v('Finalización Llave de Brazo'),
      v('Drill 1: Finalización llave de brazo'),
      v('Drill 2: Combinación de pasaje (toreos + Leg Trap) + llave de brazo'),
      v('Juego ecológico: Guardia / pasaje'),
      r(),
    ],
  },
  {
    semana_numero: 15,
    titulo: 'Escape de Montada I',
    lessons: [
      v('Concepto escape de montada'),
      v('Escape de montada variante 1'),
      v('Drill 1: Escape de montada'),
      v('Drill 2: Escape 1 + Combinación guardia (cerrada + DLR)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 16,
    titulo: 'Escape de Montada II',
    lessons: [
      v('Escape de Montada 2'),
      v('Drill 1: Escape de montada variante 2'),
      v('Drill 2: Escape 1 + Escape 2 + Combinación guardia (cerrada + DLR)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
];

const LIVIANOS_MONTH_5: PlanillaWeek[] = [
  {
    semana_numero: 17,
    titulo: 'Stack Pass + Gola Manga I',
    lessons: [
      v('Conceptos de Stack Pass'),
      v('Conceptos de Gola Manga'),
      v('Stack Pass Variante 1'),
      v('Gola Manga Variante 1'),
      v('Drill 1: Stack Pass variante 1'),
      v('Drill 2: Gola Manga variante 1'),
      r(),
    ],
  },
  {
    semana_numero: 18,
    titulo: 'Stack Pass + Gola Manga II',
    lessons: [
      v('Stack Pass variante 2'),
      v('Gola manga variante 2'),
      v('Drill 1: Stack Pass variante 2'),
      v('Drill 2: Gola manga variante 2'),
      v('Drill 3: Combinación de Gola Manga'),
      v('Drill 4: Combinación de Stack Pass'),
      r(),
    ],
  },
  {
    semana_numero: 19,
    titulo: 'Cross Grip + Gola Manga III',
    lessons: [
      v('Conceptos Cross Grip'),
      v('Cross Grip variante 1'),
      v('Gola Manga variante 3'),
      v('Drill 1: Cross Grip'),
      v('Drill 2: Gola Manga'),
      v('Drill 3: Combinación de Stack Pass'),
      v('Específico de Gola Manga'),
      r(),
    ],
  },
  {
    semana_numero: 20,
    titulo: 'Gola Manga + Cross Grip IV',
    lessons: [
      v('Gola Manga variante 4'),
      v('Cross Grip variante 2'),
      v('Drill 1: Gola Manga'),
      v('Drill 2: Cross Grip'),
      v('Drill 3: Combinación de Gola Manga'),
      v('Específico de Cross Grip'),
      r(),
    ],
  },
];

const LIVIANOS_MONTH_6: PlanillaWeek[] = [
  {
    semana_numero: 21,
    titulo: 'Defensa de Espalda I',
    lessons: [
      v('Conceptos de escapes de espalda'),
      v('Defensa 1 de espalda'),
      v('Drill 1: Defensa 1 de espalda'),
      v('Drill 2: Defensa 1 de espalda + combinación de (Gola manga + DLR)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 22,
    titulo: 'Defensa de Espalda II',
    lessons: [
      v('Defensa 2 de espalda'),
      v('Drill 1: Defensa 2 de espalda'),
      v('Drill 2: Defensa 1 + 2 de espalda + combinación de (DLR + X)'),
      v('Juego ecológico de posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 23,
    titulo: 'Ataque de Espalda I',
    lessons: [
      v('Entradas a la posición de la espalda'),
      v('Concepto de ataque de espalda'),
      v('Ataque 1 de espalda'),
      v('Drill 1: Ataque 1'),
      v('Drill 2: Combinación de pasajes + ataque de espalda'),
      v('Específico espalda'),
      r(),
    ],
  },
  {
    semana_numero: 24,
    titulo: 'Ataque de Espalda II',
    lessons: [
      v('Ataques de la espalda 2'),
      v('Drill 1: Ataque 2'),
      v('Drill 2: Combinación de pasajes + ataque 1 y 2'),
      v('Juego ecológico: Posiciones dominantes'),
      r(),
    ],
  },
];

// =============================================
// MEDIOS — Months 3-6
// =============================================

const MEDIOS_MONTH_3: PlanillaWeek[] = [
  {
    semana_numero: 9,
    titulo: 'Pasaje De la Riva + De la Riva I',
    lessons: [
      v('Conceptos Pasaje De la Riva'),
      v('Pasaje De la Riva 1'),
      v('Conceptos De la Riva'),
      v('De la Riva variante 1'),
      v('Drill 1: Pasaje de la Riva'),
      v('Drill 2: De la Riva'),
      r(),
    ],
  },
  {
    semana_numero: 10,
    titulo: 'Pasaje De la Riva + De la Riva II',
    lessons: [
      v('Pasaje De la Riva variante 2'),
      v('De la Riva variante 2'),
      v('Drill 1: Pasaje de la Riva'),
      v('Drill 2: De la Riva'),
      v('Drill en combinación: Pasajes de De la Riva'),
      r(),
    ],
  },
  {
    semana_numero: 11,
    titulo: 'Pasaje De la Riva + De la Riva III',
    lessons: [
      v('Pasaje De la Riva variante 3'),
      v('De la Riva variante 3'),
      v('Drill 1: Pasajes de la Riva'),
      v('Drill 2: De la Riva'),
      v('Específico de DLR'),
      v('Drill en combinación: Pasaje de la Riva'),
      r(),
    ],
  },
  {
    semana_numero: 12,
    titulo: 'Pasaje De la Riva + De la Riva IV',
    lessons: [
      v('De la Riva variante 4'),
      v('Pasaje De la Riva 4'),
      v('Drill 1'),
      v('Drill 2'),
      v('Drill en combinación: De la Riva'),
      v('Juego ecológico: pasaje / guardia'),
      r(),
    ],
  },
];

const MEDIOS_MONTH_4: PlanillaWeek[] = [
  {
    semana_numero: 13,
    titulo: 'Montada + Triángulo de Brazo',
    lessons: [
      v('Conceptos de montada'),
      v('Finalización Triángulo de Brazo'),
      v('Drill 1: Triángulo de brazo'),
      v('Drill 2: Combinación de pasaje DLR + triángulo de brazo'),
      v('Juego ecológico: Pasaje / guardia'),
      r(),
    ],
  },
  {
    semana_numero: 14,
    titulo: 'Llave de Brazo',
    lessons: [
      v('Finalización Llave de Brazo'),
      v('Drill 1: Finalización llave de brazo'),
      v('Drill 2: Combinación de pasaje DLR + llave de brazo'),
      v('Juego ecológico: guardia / pasaje'),
      r(),
    ],
  },
  {
    semana_numero: 15,
    titulo: 'Escape de Montada I',
    lessons: [
      v('Concepto escape de montada'),
      v('Escape de montada variante 1'),
      v('Drill 1: Escape de montada'),
      v('Drill 2: Escape 1 + Combinación guardia (cerrada + DLR)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 16,
    titulo: 'Escape de Montada II',
    lessons: [
      v('Escape de Montada 2'),
      v('Drill 1: Escape de montada variante 2'),
      v('Drill 2: Escape 1 + Escape 2 + Combinación guardia (cerrada + DLR)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
];

const MEDIOS_MONTH_5: PlanillaWeek[] = [
  {
    semana_numero: 17,
    titulo: 'Cross Grip + Guardia X I',
    lessons: [
      v('Conceptos de Cross Grip'),
      v('Conceptos de Guardia X'),
      v('Cross Grip Variante 1'),
      v('Guardia X Variante 1'),
      v('Drill 1: Cross grip variante 1'),
      v('Drill 2: Guardia X variante 1'),
      r(),
    ],
  },
  {
    semana_numero: 18,
    titulo: 'Cross Grip + Guardia X II',
    lessons: [
      v('Cross Grip variante 2'),
      v('Guardia X variante 2'),
      v('Drill 1: Cross grip variante 2'),
      v('Drill 2: Guardia X variante 2'),
      v('Drill 3: Combinación de Cross Grip'),
      v('Drill 4: Combinación de Guardia X'),
      r(),
    ],
  },
  {
    semana_numero: 19,
    titulo: 'Cross Grip + Guardia X III',
    lessons: [
      v('Cross Grip variante 3'),
      v('Guardia X variante 3'),
      v('Drill 1: Cross Grip'),
      v('Drill 2: Guardia X'),
      v('Drill 3: Combinación de cross grip'),
      v('Específico de Guardia X'),
      r(),
    ],
  },
  {
    semana_numero: 20,
    titulo: 'Guardia X + Cross Grip IV',
    lessons: [
      v('Guardia X variante 4'),
      v('Cross Grip variante 4'),
      v('Drill 1: Guardia X'),
      v('Drill 2: Cross Grip'),
      v('Drill 3: Combinación de Guardia X'),
      v('Específico de Cross Grip'),
      r(),
    ],
  },
];

const MEDIOS_MONTH_6: PlanillaWeek[] = [
  {
    semana_numero: 21,
    titulo: 'Defensa de Espalda I',
    lessons: [
      v('Conceptos de escapes de espalda'),
      v('Defensa 1 de espalda'),
      v('Drill 1: Defensa 1 de espalda'),
      v('Drill 2: Defensa 1 de espalda + combinación de (DLR + X)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 22,
    titulo: 'Defensa de Espalda II',
    lessons: [
      v('Defensa 2 de espalda'),
      v('Drill 1: Defensa 2 de espalda'),
      v('Drill 2: Defensa 1 + 2 de espalda + combinación de (DLR + X)'),
      v('Juego ecológico de posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 23,
    titulo: 'Ataque de Espalda I',
    lessons: [
      v('Entradas a la posición de la espalda'),
      v('Concepto de ataque de espalda'),
      v('Ataque 1 de espalda'),
      v('Drill 1: Ataque 1'),
      v('Drill 2: Combinación de pasajes + ataque de espalda'),
      v('Específico espalda'),
      r(),
    ],
  },
  {
    semana_numero: 24,
    titulo: 'Ataque de Espalda II',
    lessons: [
      v('Ataques de la espalda 2'),
      v('Drill 1: Ataque 2'),
      v('Drill 2: Combinación de pasajes + ataque 1 y 2'),
      v('Juego ecológico: Posiciones dominantes'),
      r(),
    ],
  },
];

// =============================================
// SIMBIO — Months 3-6
// =============================================

const SIMBIO_MONTH_3: PlanillaWeek[] = [
  {
    semana_numero: 9,
    titulo: 'Reverse DLR + 1/2 Guardia I',
    lessons: [
      v('Conceptos Reverse De la Riva (pasaje)'),
      v('Conceptos de 1/2 guardia'),
      v('1/2 guardia Knee Lever'),
      v('Pasaje Reverse De la Riva: Cross Knee'),
      v('Drill 1: Reverse de la Riva (pasaje)'),
      v('Drill 2: 1/2 guardia variante 1'),
      r(),
    ],
  },
  {
    semana_numero: 10,
    titulo: 'Reverse DLR + 1/2 Guardia II',
    lessons: [
      v('Pasaje Reverse De la Riva: Planchar la media'),
      v('1/2 Guardia: Windmill'),
      v('Drill 1: Reverse de la Riva (pasaje)'),
      v('Drill 2: 1/2 guardia'),
      v('Drill en combinación: Reverse de la Riva (pasaje)'),
      r(),
    ],
  },
  {
    semana_numero: 11,
    titulo: 'Over Under + 1/2 Guardia III',
    lessons: [
      v('Over Under concepto'),
      v('Over under variante 1'),
      v('1/2 guardia: Sit up'),
      v('Drill 1: Over under'),
      v('Drill 2: Sit up'),
      v('Drill en combinación: Reverse de la Riva (pasaje)'),
      v('Específico de 1/2 guardia'),
      r(),
    ],
  },
  {
    semana_numero: 12,
    titulo: 'Over Under + 1/2 Guardia IV',
    lessons: [
      v('Over Under variante 2'),
      v('1/2 guardia: Lower Leg Shift'),
      v('Drill 1: Over Under'),
      v('Drill 2: Lower Leg Shift'),
      v('Drill en combinación: 1/2 guardia'),
      v('Juego ecológico: pasaje / guardia'),
      r(),
    ],
  },
];

const SIMBIO_MONTH_4: PlanillaWeek[] = [
  {
    semana_numero: 13,
    titulo: 'Montada + Triángulo de Brazo',
    lessons: [
      v('Conceptos de montada'),
      v('Finalización Triángulo de Brazo'),
      v('Drill 1: Triángulo de brazo'),
      v('Drill 2: Combinación de pasaje DLR + triángulo de brazo'),
      v('Juego ecológico: pasaje / guardia'),
      r(),
    ],
  },
  {
    semana_numero: 14,
    titulo: 'Llave de Brazo',
    lessons: [
      v('Finalización Llave de Brazo'),
      v('Drill 1: Finalización llave de brazo'),
      v('Drill 2: Combinación de pasaje DLR + llave de brazo'),
      v('Juego ecológico: guardia / pasaje'),
      r(),
    ],
  },
  {
    semana_numero: 15,
    titulo: 'Escape de Montada I',
    lessons: [
      v('Concepto escape de montada'),
      v('Escape de montada variante 1'),
      v('Drill 1: Escape de montada'),
      v('Drill 2: Escape 1 + Combinación guardia DLR'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 16,
    titulo: 'Escape de Montada II',
    lessons: [
      v('Escape de Montada 2'),
      v('Drill 1: Escape de montada variante 2'),
      v('Drill 2: Escape 1 + Escape 2 + Combinación guardia DLR'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
];

const SIMBIO_MONTH_5: PlanillaWeek[] = [
  {
    semana_numero: 17,
    titulo: '1/2 Guardia Knee Shield + Cross Grip I',
    lessons: [
      v('Concepto de 1/2 guardia con Knee Shield'),
      v('Conceptos de Cross Grip'),
      v('Dog fight variante 1'),
      v('Cross Grip Variante 1'),
      v('Drill 1: Cross grip variante 1'),
      v('Drill 2: Dog fight'),
      r(),
    ],
  },
  {
    semana_numero: 18,
    titulo: 'Cross Grip + Dog Fight II',
    lessons: [
      v('Cross Grip variante 2'),
      v('Dog fight variante 2'),
      v('Drill 1: Cross grip variante 2'),
      v('Drill 2: Dog fight variante 2'),
      v('Drill 3: Combinación de Cross Grip'),
      v('Drill 4: Combinación de Dog Fight'),
      r(),
    ],
  },
  {
    semana_numero: 19,
    titulo: 'Butterfly + Cross Grip III',
    lessons: [
      v('Conceptos de Butterfly'),
      v('Butterfly variante 1'),
      v('Cross Grip variante 3'),
      v('Drill 1: Butterfly variante 1'),
      v('Drill 2: Cross Grip variante 3'),
      v('Drill 3: Combinación de cross grip'),
      v('Específico de 1/2 guardia con Knee Shield'),
      r(),
    ],
  },
  {
    semana_numero: 20,
    titulo: 'Butterfly + Cross Grip IV',
    lessons: [
      v('Butterfly variante 2'),
      v('Cross Grip variante 4'),
      v('Drill 1: Butterfly variante 2'),
      v('Drill 2: Cross Grip'),
      v('Drill 3: Combinación de 1/2 con Knee Shield'),
      v('Específico de Cross Grip'),
      r(),
    ],
  },
];

const SIMBIO_MONTH_6: PlanillaWeek[] = [
  {
    semana_numero: 21,
    titulo: 'Defensa de Espalda I',
    lessons: [
      v('Conceptos de escapes de espalda'),
      v('Defensa 1 de espalda'),
      v('Drill 1: Defensa 1 de espalda'),
      v('Drill 2: Defensa 1 de espalda + combinación de (1/2 guardia + 1/2 guardia con Knee Shield)'),
      v('Juego ecológico: posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 22,
    titulo: 'Defensa de Espalda II',
    lessons: [
      v('Defensa 2 de espalda'),
      v('Drill 1: Defensa 2 de espalda'),
      v('Drill 2: Defensa 1 + 2 de espalda + combinación de (1/2 guardia + 1/2 guardia con Knee Shield)'),
      v('Juego ecológico de posiciones dominantes'),
      r(),
    ],
  },
  {
    semana_numero: 23,
    titulo: 'Ataque de Espalda I',
    lessons: [
      v('Entradas a la posición de la espalda'),
      v('Concepto de ataque de espalda'),
      v('Ataque 1 de espalda'),
      v('Drill 1: Ataque 1'),
      v('Drill 2: Combinación de pasajes + ataque de espalda'),
      v('Específico espalda'),
      r(),
    ],
  },
  {
    semana_numero: 24,
    titulo: 'Ataque de Espalda II',
    lessons: [
      v('Ataques de la espalda 2'),
      v('Drill 1: Ataque 2'),
      v('Drill 2: Combinación de pasajes + ataque 1 y 2'),
      v('Juego ecológico: Posiciones dominantes'),
      r(),
    ],
  },
];

// =============================================
// ASSEMBLED PLANILLAS
// =============================================

export const PLANILLAS: Planilla[] = [
  {
    id: 'livianos',
    nombre: 'Livianos',
    descripcion: 'Programa enfocado en Leg Trap, Stack Pass, Gola Manga y Cross Grip',
    weeks: [
      FUNDAMENTOS,
      ...SHARED_MONTH_1,
      ...SHARED_MONTH_2,
      ...LIVIANOS_MONTH_3,
      ...LIVIANOS_MONTH_4,
      ...LIVIANOS_MONTH_5,
      ...LIVIANOS_MONTH_6,
    ],
  },
  {
    id: 'medios',
    nombre: 'Medios',
    descripcion: 'Programa enfocado en Pasaje De la Riva, Cross Grip y Guardia X',
    weeks: [
      FUNDAMENTOS,
      ...SHARED_MONTH_1,
      ...SHARED_MONTH_2,
      ...MEDIOS_MONTH_3,
      ...MEDIOS_MONTH_4,
      ...MEDIOS_MONTH_5,
      ...MEDIOS_MONTH_6,
    ],
  },
  {
    id: 'simbio',
    nombre: 'Simbio',
    descripcion: 'Programa enfocado en Reverse DLR, 1/2 Guardia, Over Under, Butterfly y Dog Fight',
    weeks: [
      FUNDAMENTOS,
      ...SHARED_MONTH_1,
      ...SHARED_MONTH_2,
      ...SIMBIO_MONTH_3,
      ...SIMBIO_MONTH_4,
      ...SIMBIO_MONTH_5,
      ...SIMBIO_MONTH_6,
    ],
  },
  {
    id: 'atleticos',
    nombre: 'Atleticos',
    descripcion: 'Programa para competidores atleticos (proximamente)',
    weeks: [],
  },
];

/**
 * Generate lesson IDs and full structure for saving to course_data
 */
export function getPlanillaForSave(planillaId: string) {
  const planilla = PLANILLAS.find((p) => p.id === planillaId);
  if (!planilla) return null;

  return planilla.weeks.map((week) => ({
    module_id: `mod-${week.semana_numero}`,
    semana_numero: week.semana_numero,
    titulo: week.titulo,
    descripcion: '',
    lessons: week.lessons.map((lesson, idx) => ({
      id: `${planillaId}-s${week.semana_numero}-${idx}`,
      titulo: lesson.titulo,
      tipo: lesson.tipo,
      youtube_id: '',
      descripcion: '',
      orden: idx,
    })),
  }));
}

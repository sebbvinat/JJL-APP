// Curso: Personalizado Atletico — Jiu Jitsu Latino

export const COURSE_NAME = 'Personalizado Atletico';

export const MOCK_MODULES = [
  { id: 'mod-0', semana_numero: 0, titulo: 'Fundamentos', descripcion: 'Conceptos claves para todas las posiciones' },
  { id: 'mod-1', semana_numero: 1, titulo: 'Guardia Cerrada + Toreos', descripcion: 'Mes 1 — Triangulo, conceptos de toreos y primeros drills' },
  { id: 'mod-2', semana_numero: 2, titulo: 'Top Lock + Toreos V2', descripcion: 'Mes 1 — Top Lock y variante 2 de toreos' },
  { id: 'mod-3', semana_numero: 3, titulo: 'Toma de Espalda + Toreos V3', descripcion: 'Mes 1 — Toma de espalda desde guardia cerrada y drills combinados' },
  { id: 'mod-4', semana_numero: 4, titulo: 'Flower/Pendulo + Toreos V4', descripcion: 'Mes 1 — Flower sweep, pendulo y especifico de guardia cerrada' },
  { id: 'mod-5', semana_numero: 5, titulo: '100 KG + Kimura', descripcion: 'Mes 2 — Concepto de 100 kg, finalizacion Kimura' },
  { id: 'mod-6', semana_numero: 6, titulo: 'Armbar + Especifico', descripcion: 'Mes 2 — Finalizacion Armbar y especifico de guardia cerrada' },
  { id: 'mod-7', semana_numero: 7, titulo: 'Escape 100 KG', descripcion: 'Mes 2 — Escape de 100 kilos y combinaciones' },
  { id: 'mod-8', semana_numero: 8, titulo: 'Escape 100 KG V2', descripcion: 'Mes 2 — Variante 2 del escape y drill combinado' },
  { id: 'mod-9', semana_numero: 9, titulo: 'Leg Trap + De la Riva', descripcion: 'Mes 3 — Conceptos de Leg Trap y De la Riva' },
  { id: 'mod-10', semana_numero: 10, titulo: 'Leg Trap V2 + DLR V2', descripcion: 'Mes 3 — Variantes 2 y drills combinados' },
  { id: 'mod-11', semana_numero: 11, titulo: 'Leg Trap V3 + DLR V3', descripcion: 'Mes 3 — Variantes 3 y especifico de DLR' },
  { id: 'mod-12', semana_numero: 12, titulo: 'Leg Trap V4 + DLR V4', descripcion: 'Mes 3 — Variantes 4 y juego ecologico pasaje/guardia' },
  { id: 'mod-13', semana_numero: 13, titulo: 'Montada + Triangulo de Brazo', descripcion: 'Mes 4 — Conceptos de montada y finalizacion triangulo de brazo' },
  { id: 'mod-14', semana_numero: 14, titulo: 'Llave de Brazo', descripcion: 'Mes 4 — Finalizacion llave de brazo y juego ecologico' },
  { id: 'mod-15', semana_numero: 15, titulo: 'Escape de Montada', descripcion: 'Mes 4 — Concepto y variante 1 del escape de montada' },
  { id: 'mod-16', semana_numero: 16, titulo: 'Escape de Montada V2', descripcion: 'Mes 4 — Variante 2 y combinaciones de guardia' },
  { id: 'mod-17', semana_numero: 17, titulo: 'Cross Grip + Gola Manga', descripcion: 'Mes 5 — Conceptos de Cross Grip y Gola manga' },
  { id: 'mod-18', semana_numero: 18, titulo: 'Cross Grip V2 + Gola Manga V2', descripcion: 'Mes 5 — Variantes 2 y drills de combinacion' },
  { id: 'mod-19', semana_numero: 19, titulo: 'Cross Grip V3 + Gola Manga V3', descripcion: 'Mes 5 — Variantes 3 y especifico de Gola manga' },
  { id: 'mod-20', semana_numero: 20, titulo: 'Cross Grip V4 + Gola Manga V4', descripcion: 'Mes 5 — Variantes 4 y especifico de Cross Grip' },
  { id: 'mod-21', semana_numero: 21, titulo: 'Defensa de Espalda', descripcion: 'Mes 6 — Conceptos de escapes y defensa 1 de espalda' },
  { id: 'mod-22', semana_numero: 22, titulo: 'Defensa de Espalda V2', descripcion: 'Mes 6 — Defensa 2 y juego ecologico de posiciones dominantes' },
  { id: 'mod-23', semana_numero: 23, titulo: 'Ataques de Espalda', descripcion: 'Mes 6 — Entradas, conceptos y ataque 1 de espalda' },
  { id: 'mod-24', semana_numero: 24, titulo: 'Ataques de Espalda V2', descripcion: 'Mes 6 — Ataque 2, combinaciones de pasajes y juego ecologico final' },
];

// Lesson type: 'video' = normal video lesson, 'reflection' = weekly reflection form
export interface MockLesson {
  id: string;
  titulo: string;
  youtube_id: string;
  descripcion: string;
  orden: number;
  duracion: string;
  completed: boolean;
  tipo: 'video' | 'reflection';
}

export const MOCK_LESSONS: Record<string, MockLesson[]> = {
  'mod-0': [
    { id: 'les-0-1', titulo: 'Llamado a guardia cerrada', youtube_id: 'dUxhJHQ54Gg', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-0-2', titulo: 'Apertura de guardia', youtube_id: 's4SPE-fe1jo', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-0-3', titulo: 'Retencion de guardia', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-0-4', titulo: 'Concepto de Pasaje', youtube_id: 'XnO6TeVky4s', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
  ],
  'mod-1': [
    { id: 'les-1-1', titulo: 'Introduccion', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-1-2', titulo: 'Guardia Cerrada Conceptos', youtube_id: 'MzuPY_e1PXc', descripcion: '', orden: 2, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-1-3', titulo: 'Guardia cerrada: Triangulo', youtube_id: 'VHgmbNpcUFk', descripcion: '', orden: 3, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-1-4', titulo: 'Toreos: conceptos', youtube_id: '54mccu1o81M', descripcion: '', orden: 4, duracion: '11:00', completed: false, tipo: 'video' },
    { id: 'les-1-5', titulo: 'Toreos Variante 1', youtube_id: 'ENySL6LZUkw', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-1-6', titulo: 'Drill 1: Guardia cerrada', youtube_id: '_5cf4LGtmWo', descripcion: '', orden: 6, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-1-7', titulo: 'Drill 2: Toreos', youtube_id: 'GvqXaIXzWAM', descripcion: '', orden: 7, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-1-8', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 8, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-2': [
    { id: 'les-2-1', titulo: 'Guardia cerrada: Top Lock', youtube_id: 'zTIbX29qSfM', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-2-2', titulo: 'Toreos Variante 2', youtube_id: 'e96uxETi2dU', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-2-3', titulo: 'Drill 1: Toreos', youtube_id: 'GvqXaIXzWAM', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-2-4', titulo: 'Drill 2: Guardia cerrada', youtube_id: 'LH7qAPT2jMw', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-2-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-3': [
    { id: 'les-3-1', titulo: 'Guardia cerrada: Toma de espalda', youtube_id: 'wUWELg_DMXY', descripcion: '', orden: 1, duracion: '13:00', completed: false, tipo: 'video' },
    { id: 'les-3-2', titulo: 'Toreos Variante 3', youtube_id: 'ZOa2PEUBNWg', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-3-3', titulo: 'Drill 1: Guardia cerrada', youtube_id: 'gAlF9BV8Vgs', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-3-4', titulo: 'Drill 2: Toreos', youtube_id: 'P5FQWD9dq4k', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-3-5', titulo: 'Drill en combinacion: Guardia cerrada', youtube_id: '1tFPeXVh0bk', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-3-6', titulo: 'Drill en combinacion: Toreos', youtube_id: 'le-2g4aWFFg', descripcion: '', orden: 6, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-3-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-4': [
    { id: 'les-4-1', titulo: 'Guardia cerrada: Flower / Pendulo', youtube_id: '', descripcion: '', orden: 1, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-4-2', titulo: 'Toreos Variante 4', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-4-3', titulo: 'Drill 1: Guardia cerrada', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-4-4', titulo: 'Drill 2: Toreos', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-4-5', titulo: 'Drill en combinacion: Toreos', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-4-6', titulo: 'Especifico de guardia cerrada', youtube_id: '', descripcion: '', orden: 6, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-4-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-5': [
    { id: 'les-5-1', titulo: 'Concepto de 100 KG', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-5-2', titulo: 'Finalizacion Kimura', youtube_id: '', descripcion: '', orden: 2, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-5-3', titulo: 'Drill 1: Kimura', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-5-4', titulo: 'Drill 2: Combinacion toreos + Kimura', youtube_id: '', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-5-5', titulo: 'Observaciones finales toreo', youtube_id: '', descripcion: '', orden: 5, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-5-6', titulo: 'Especifico de toreos', youtube_id: '', descripcion: '', orden: 6, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-5-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-6': [
    { id: 'les-6-1', titulo: 'Finalizacion Armbar', youtube_id: '', descripcion: '', orden: 1, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-6-2', titulo: 'Drill 1: Armbar', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-6-3', titulo: 'Drill 2: Combinacion toreos + armbar', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-6-4', titulo: 'Especifico guardia cerrada', youtube_id: '', descripcion: '', orden: 4, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-6-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-7': [
    { id: 'les-7-1', titulo: 'Escape 100 kilos', youtube_id: '', descripcion: '', orden: 1, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-7-2', titulo: 'Drill 1: Escape de 100kg', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-7-3', titulo: 'Drill 2: Escape + Combinacion Guardia cerrada', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-7-4', titulo: 'Especifico de 100KG', youtube_id: '', descripcion: '', orden: 4, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-7-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-8': [
    { id: 'les-8-1', titulo: 'Escape de 100KG variante 2', youtube_id: '', descripcion: '', orden: 1, duracion: '13:00', completed: false, tipo: 'video' },
    { id: 'les-8-2', titulo: 'Drill 1: 100 KG variante 2', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-8-3', titulo: 'Drill 2: Combinacion escape + guardia cerrada', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-8-4', titulo: 'Especifico de guardia cerrada', youtube_id: '', descripcion: '', orden: 4, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-8-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-9': [
    { id: 'les-9-1', titulo: 'Conceptos Leg Trap', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-9-2', titulo: 'Conceptos De la Riva', youtube_id: '', descripcion: '', orden: 2, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-9-3', titulo: 'Leg Trap 1', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-9-4', titulo: 'De la Riva variante 1', youtube_id: '', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-9-5', titulo: 'Drill 1: Leg trap', youtube_id: '', descripcion: '', orden: 5, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-9-6', titulo: 'Drill 2: De la Riva', youtube_id: '', descripcion: '', orden: 6, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-9-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-10': [
    { id: 'les-10-1', titulo: 'Leg Trap variante 2', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-10-2', titulo: 'De la Riva variante 2', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-10-3', titulo: 'Drill 1: Leg Trap', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-10-4', titulo: 'Drill 2: De la Riva', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-10-5', titulo: 'Drill en combinacion: Leg Trap', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-10-6', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 6, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-11': [
    { id: 'les-11-1', titulo: 'Leg Trap variante 3', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-11-2', titulo: 'De la Riva variante 3', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-11-3', titulo: 'Drill 1: Leg Trap', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-11-4', titulo: 'Drill 2: De la Riva', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-11-5', titulo: 'Drill en combinacion: Leg trap', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-11-6', titulo: 'Especifico de DLR', youtube_id: '', descripcion: '', orden: 6, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-11-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-12': [
    { id: 'les-12-1', titulo: 'Leg Trap variante 4', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-12-2', titulo: 'De la Riva variante 4', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-12-3', titulo: 'Drill 1: Leg Trap', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-12-4', titulo: 'Drill 2: De la Riva', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-12-5', titulo: 'Drill en combinacion: De la Riva', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-12-6', titulo: 'Juego ecologico: pasaje / guardia', youtube_id: '', descripcion: '', orden: 6, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-12-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-13': [
    { id: 'les-13-1', titulo: 'Conceptos de montada', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-13-2', titulo: 'Finalizacion Triangulo de Brazo', youtube_id: '', descripcion: '', orden: 2, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-13-3', titulo: 'Drill 1: Triangulo de brazo', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-13-4', titulo: 'Drill 2: Combinacion pasaje + triangulo de brazo', youtube_id: '', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-13-5', titulo: 'Juego ecologico: pasaje / guardia', youtube_id: '', descripcion: '', orden: 5, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-13-6', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 6, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-14': [
    { id: 'les-14-1', titulo: 'Finalizacion Llave de Brazo', youtube_id: '', descripcion: '', orden: 1, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-14-2', titulo: 'Drill 1: Llave de brazo', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-14-3', titulo: 'Drill 2: Combinacion pasaje + llave de brazo', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-14-4', titulo: 'Juego ecologico: guardia / pasaje', youtube_id: '', descripcion: '', orden: 4, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-14-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-15': [
    { id: 'les-15-1', titulo: 'Concepto escape de montada', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-15-2', titulo: 'Escape de montada variante 1', youtube_id: '', descripcion: '', orden: 2, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-15-3', titulo: 'Drill 1: Escape de montada', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-15-4', titulo: 'Drill 2: Escape + Combinacion guardia', youtube_id: '', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-15-5', titulo: 'Juego ecologico: posiciones dominantes', youtube_id: '', descripcion: '', orden: 5, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-15-6', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 6, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-16': [
    { id: 'les-16-1', titulo: 'Escape de Montada 2', youtube_id: '', descripcion: '', orden: 1, duracion: '13:00', completed: false, tipo: 'video' },
    { id: 'les-16-2', titulo: 'Drill 1: Escape de montada variante 2', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-16-3', titulo: 'Drill 2: Escape 1 + 2 + Combinacion guardia', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-16-4', titulo: 'Juego ecologico: posiciones dominantes', youtube_id: '', descripcion: '', orden: 4, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-16-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-17': [
    { id: 'les-17-1', titulo: 'Conceptos de Cross Grip', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-17-2', titulo: 'Gola manga conceptos', youtube_id: '', descripcion: '', orden: 2, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-17-3', titulo: 'Cross Grip Variante 1', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-17-4', titulo: 'Gola manga Variante 1', youtube_id: '', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-17-5', titulo: 'Drill 1: Cross grip variante 1', youtube_id: '', descripcion: '', orden: 5, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-17-6', titulo: 'Drill 2: Gola manga variante 1', youtube_id: '', descripcion: '', orden: 6, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-17-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-18': [
    { id: 'les-18-1', titulo: 'Cross Grip variante 2', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-18-2', titulo: 'Gola manga variante 2', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-18-3', titulo: 'Drill 1: Cross grip variante 2', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-18-4', titulo: 'Drill 2: Gola manga variante 2', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-18-5', titulo: 'Drill 3: Combinacion de cross grip', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-18-6', titulo: 'Drill 4: Combinacion de Gola manga', youtube_id: '', descripcion: '', orden: 6, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-18-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-19': [
    { id: 'les-19-1', titulo: 'Gola manga variante 3', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-19-2', titulo: 'Cross Grip variante 3', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-19-3', titulo: 'Drill 1: Gola manga variante 3', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-19-4', titulo: 'Drill 2: Cross Grip variante 3', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-19-5', titulo: 'Drill 3: Combinacion de cross grip', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-19-6', titulo: 'Especifico de Gola manga', youtube_id: '', descripcion: '', orden: 6, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-19-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-20': [
    { id: 'les-20-1', titulo: 'Gola manga variante 4', youtube_id: '', descripcion: '', orden: 1, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-20-2', titulo: 'Cross Grip variante 4', youtube_id: '', descripcion: '', orden: 2, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-20-3', titulo: 'Drill 1: Gola manga', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-20-4', titulo: 'Drill 2: Cross grip', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-20-5', titulo: 'Drill 3: Combinacion de Gola manga', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-20-6', titulo: 'Especifico de Cross Grip', youtube_id: '', descripcion: '', orden: 6, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-20-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-21': [
    { id: 'les-21-1', titulo: 'Conceptos de escapes de espalda', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-21-2', titulo: 'Defensa 1 de espalda', youtube_id: '', descripcion: '', orden: 2, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-21-3', titulo: 'Drill 1: Defensa 1 de espalda', youtube_id: '', descripcion: '', orden: 3, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-21-4', titulo: 'Drill 2: Defensa + combinacion Gola manga + DLR', youtube_id: '', descripcion: '', orden: 4, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-21-5', titulo: 'Juego ecologico: posiciones dominantes', youtube_id: '', descripcion: '', orden: 5, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-21-6', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 6, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-22': [
    { id: 'les-22-1', titulo: 'Defensa 2 de espalda', youtube_id: '', descripcion: '', orden: 1, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-22-2', titulo: 'Drill 1: Defensa 2 de espalda', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-22-3', titulo: 'Drill 2: Defensa 1 + 2 + combinacion Gola Manga + DLR', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-22-4', titulo: 'Juego ecologico de posiciones dominantes', youtube_id: '', descripcion: '', orden: 4, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-22-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-23': [
    { id: 'les-23-1', titulo: 'Entradas a la posicion de la espalda', youtube_id: '', descripcion: '', orden: 1, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-23-2', titulo: 'Concepto de ataque de espalda', youtube_id: '', descripcion: '', orden: 2, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-23-3', titulo: 'Ataque 1 de espalda', youtube_id: '', descripcion: '', orden: 3, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-23-4', titulo: 'Drill 1: Ataque 1', youtube_id: '', descripcion: '', orden: 4, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-23-5', titulo: 'Drill 2: Combinacion de pasajes + ataque de espalda', youtube_id: '', descripcion: '', orden: 5, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-23-6', titulo: 'Especifico de espalda', youtube_id: '', descripcion: '', orden: 6, duracion: '12:00', completed: false, tipo: 'video' },
    { id: 'les-23-7', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 7, duracion: '', completed: false, tipo: 'reflection' },
  ],
  'mod-24': [
    { id: 'les-24-1', titulo: 'Ataques de la espalda 2', youtube_id: '', descripcion: '', orden: 1, duracion: '14:00', completed: false, tipo: 'video' },
    { id: 'les-24-2', titulo: 'Drill 1: Ataque 2', youtube_id: '', descripcion: '', orden: 2, duracion: '8:00', completed: false, tipo: 'video' },
    { id: 'les-24-3', titulo: 'Drill 2: Combinacion de pasajes + ataque 1 y 2', youtube_id: '', descripcion: '', orden: 3, duracion: '10:00', completed: false, tipo: 'video' },
    { id: 'les-24-4', titulo: 'Juego ecologico: posiciones dominantes', youtube_id: '', descripcion: '', orden: 4, duracion: '15:00', completed: false, tipo: 'video' },
    { id: 'les-24-5', titulo: 'Reflexion semanal', youtube_id: '', descripcion: 'Responde las preguntas de reflexion de la semana', orden: 5, duracion: '', completed: false, tipo: 'reflection' },
  ],
};

// Auto-apply descriptions based on lesson title patterns
const DRILL_DESC = '1x5\' drillear de cada lado. (en cada entrenamiento)\n\nSi ya estas avanzado con el drill, podes pedirle resistencia al compañero de forma escalonada de 0% a max 50%';
const ESPECIFICO_DESC = '1x5\' (en cada entrenamiento)';
const JUEGO_ECO_DESC = '1x5\' (en cada entrenamiento)';

for (const modId of Object.keys(MOCK_LESSONS)) {
  for (const lesson of MOCK_LESSONS[modId]) {
    if (lesson.tipo === 'reflection') continue;
    const t = lesson.titulo.toLowerCase();
    if (t.includes('drill')) {
      lesson.descripcion = DRILL_DESC;
    } else if (t.includes('especifico') || t.includes('específico')) {
      lesson.descripcion = ESPECIFICO_DESC;
    } else if (t.includes('juego ecologico') || t.includes('juego ecológico')) {
      lesson.descripcion = JUEGO_ECO_DESC;
    }
  }
}

// Which modules are unlocked (mock: first 4 + fundamentos)
export const MOCK_UNLOCKED_MODULES = ['mod-0', 'mod-1', 'mod-2', 'mod-3', 'mod-4'];

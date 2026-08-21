// Helpers de formato para JJL Cursos.

/** Etiqueta legible del período de acceso. NULL = de por vida. */
export function accesoLabel(meses: number | null): string {
  if (meses == null) return 'Acceso de por vida';
  if (meses % 12 === 0) {
    const anios = meses / 12;
    return `Acceso por ${anios} ${anios === 1 ? 'año' : 'años'}`;
  }
  return `Acceso por ${meses} meses`;
}

/** Precio mostrable: usa precio_label si existe, si no arma desde precio. */
export function priceLabel(
  precioLabel: string | null,
  precio: number | null
): string {
  if (precioLabel) return precioLabel;
  if (precio != null) return `$${precio}`;
  return 'Consultar';
}

// ---- Derivados de curriculum_preview (para páginas de venta) ----

import type { CurriculumPreviewSection } from './types';

/** Total de lecciones según el preview del currículum. */
export function countLessons(preview: CurriculumPreviewSection[] | null): number {
  return (preview ?? []).reduce((acc, s) => acc + s.lecciones.length, 0);
}

/** Cuántas clases incluyen material de estudio escrito. */
export function countStudyMaterial(preview: CurriculumPreviewSection[] | null): number {
  return (preview ?? []).reduce(
    (acc, s) =>
      acc + s.lecciones.filter((l) => /material de estudio/i.test(l)).length,
    0
  );
}

/** Título de lección sin el sufijo "+ MATERIAL DE ESTUDIO" (queda como pill aparte). */
export function cleanLessonTitle(titulo: string): {
  titulo: string;
  material: boolean;
} {
  const material = /\+?\s*material de estudio/i.test(titulo);
  return {
    titulo: titulo.replace(/\s*\+?\s*material de estudio\s*$/i, '').trim(),
    material,
  };
}

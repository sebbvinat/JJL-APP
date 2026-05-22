// Tipos del producto "JJL Cursos" (cursos sueltos / instruccionales).
// Separado del programa de 6 meses. Tablas cursos_* en Supabase.

export type CursosLessonTipo = 'video' | 'texto';

/** Documento de texto enriquecido (TipTap JSON) usado en lesson.material. */
export type RichText = {
  type: string;
  content?: unknown[];
  [key: string]: unknown;
};

// ---- sales_copy (JSONB en cursos_courses / cursos_bundles) ----

export interface SalesBlock {
  titulo: string;
  cuerpo: string;
}

export interface SalesBonus {
  titulo: string;
  descripcion: string;
  valor?: string;
}

export interface SalesFaq {
  pregunta: string;
  respuesta: string;
}

export interface SalesCopy {
  headline?: string;
  subheadline?: string;
  problema?: SalesBlock[];
  solucion?: SalesBlock[];
  highlights?: string[];
  bonos?: SalesBonus[];
  garantia?: SalesBlock;
  faqs?: SalesFaq[];
}

/** curriculum_preview (JSONB): estructura del curso para la página de venta, sin youtube_id. */
export interface CurriculumPreviewSection {
  titulo: string;
  lecciones: string[];
}

// ---- Row types ----

export interface CursosCourse {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  descripcion: string | null;
  instructor: string | null;
  cover_url: string | null;
  trailer_youtube_id: string | null;
  precio: number | null;
  precio_label: string | null;
  payment_url: string | null;
  sales_copy: SalesCopy;
  curriculum_preview: CurriculumPreviewSection[];
  nivel: string | null;
  publicado: boolean;
  orden: number;
  duracion_acceso_meses: number | null; // NULL = de por vida
  created_at: string;
  updated_at: string;
}

export interface CursosBundle {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  descripcion: string | null;
  cover_url: string | null;
  precio: number | null;
  precio_label: string | null;
  payment_url: string | null;
  sales_copy: SalesCopy;
  publicado: boolean;
  orden: number;
  duracion_acceso_meses: number | null;
  created_at: string;
  updated_at: string;
}

export interface CursosBundleItem {
  bundle_id: string;
  course_id: string;
  orden: number;
}

export interface CursosSection {
  id: string;
  course_id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  created_at: string;
}

export interface CursosLesson {
  id: string;
  section_id: string;
  course_id: string;
  tipo: CursosLessonTipo;
  titulo: string;
  youtube_id: string | null;
  contenido: string | null;
  material: RichText | null;
  duracion: string | null;
  orden: number;
  created_at: string;
}

export interface CursosAccess {
  id: string;
  user_id: string;
  course_id: string;
  source_bundle_id: string | null;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null; // NULL = de por vida
  revoked: boolean;
  notas: string | null;
}

export interface CursosProgress {
  user_id: string;
  lesson_id: string;
  completado: boolean;
  completed_at: string | null;
}

/**
 * Script de Migración: Tutor LMS → Supabase
 *
 * Lee tutor_lms_export.csv de la raíz del proyecto y migra
 * cursos y lecciones a las tablas 'modules' y 'lessons' de Supabase.
 *
 * Uso:
 *   npx tsx scripts/migrate-csv.ts
 *
 * Requisitos:
 *   - .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *   - tutor_lms_export.csv en la raíz del proyecto
 *
 * Formato CSV esperado de Tutor LMS:
 *   course_id, course_title, lesson_id, lesson_title, lesson_order, video_url
 *
 * El script:
 *   1. Parsea el CSV
 *   2. Agrupa lecciones por curso
 *   3. Mapea cursos → módulos (por orden de aparición = semana_numero)
 *   4. Extrae youtube_id de la URL del video
 *   5. Inserta módulos y lecciones en Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---- Config ----
const CSV_PATH = resolve(process.cwd(), 'tutor_lms_export.csv');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin access

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Faltan variables de entorno.');
  console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

if (!existsSync(CSV_PATH)) {
  console.error(`❌ Error: No se encontró el archivo CSV en: ${CSV_PATH}`);
  console.error('   Coloca tu archivo tutor_lms_export.csv en la raíz del proyecto.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- CSV Parser ----
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV vacío o sin datos');
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  return lines.slice(1).map((line, idx) => {
    // Handle commas inside quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i]?.replace(/^['"]|['"]$/g, '') || '';
    });

    return row;
  });
}

// ---- YouTube ID Extractor ----
function extractYoutubeId(url: string): string {
  if (!url) return 'dQw4w9WgXcQ'; // Placeholder

  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Raw ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return url; // Return as-is if no pattern matches
}

// ---- Main Migration ----
async function migrate() {
  console.log('🔄 Iniciando migración desde Tutor LMS...');
  console.log(`📄 Leyendo: ${CSV_PATH}\n`);

  const content = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(content);

  console.log(`📊 ${rows.length} filas encontradas en el CSV\n`);

  // Group lessons by course
  const coursesMap = new Map<string, {
    courseId: string;
    courseTitle: string;
    lessons: Array<{
      lessonId: string;
      lessonTitle: string;
      lessonOrder: number;
      videoUrl: string;
    }>;
  }>();

  for (const row of rows) {
    const courseId = row['course_id'] || row['id_curso'] || row['curso_id'] || '';
    const courseTitle = row['course_title'] || row['titulo_curso'] || row['curso'] || '';
    const lessonId = row['lesson_id'] || row['id_leccion'] || row['leccion_id'] || '';
    const lessonTitle = row['lesson_title'] || row['titulo_leccion'] || row['leccion'] || '';
    const lessonOrder = parseInt(row['lesson_order'] || row['orden'] || '0', 10);
    const videoUrl = row['video_url'] || row['video'] || row['youtube_url'] || row['url'] || '';

    if (!courseTitle) continue;

    if (!coursesMap.has(courseId || courseTitle)) {
      coursesMap.set(courseId || courseTitle, {
        courseId,
        courseTitle,
        lessons: [],
      });
    }

    if (lessonTitle) {
      coursesMap.get(courseId || courseTitle)!.lessons.push({
        lessonId,
        lessonTitle,
        lessonOrder: lessonOrder || coursesMap.get(courseId || courseTitle)!.lessons.length + 1,
        videoUrl,
      });
    }
  }

  const courses = Array.from(coursesMap.values());
  console.log(`📚 ${courses.length} cursos/módulos detectados:\n`);

  // Insert modules
  let moduleCount = 0;
  let lessonCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const semanaNumero = i + 1;

    console.log(`  📖 Semana ${semanaNumero}: ${course.courseTitle} (${course.lessons.length} lecciones)`);

    // Insert module
    const { data: moduleData, error: moduleError } = await supabase
      .from('modules')
      .upsert({
        semana_numero: semanaNumero,
        titulo: course.courseTitle,
      }, {
        onConflict: 'semana_numero',
      })
      .select('id')
      .single();

    if (moduleError) {
      errors.push(`Error insertando módulo S${semanaNumero}: ${moduleError.message}`);
      console.error(`     ❌ Error: ${moduleError.message}`);
      continue;
    }

    moduleCount++;
    const moduleId = moduleData.id;

    // Sort lessons by order
    course.lessons.sort((a, b) => a.lessonOrder - b.lessonOrder);

    // Insert lessons
    for (const lesson of course.lessons) {
      const youtubeId = extractYoutubeId(lesson.videoUrl);

      const { error: lessonError } = await supabase
        .from('lessons')
        .upsert({
          module_id: moduleId,
          titulo: lesson.lessonTitle,
          youtube_id: youtubeId,
          orden: lesson.lessonOrder,
          descripcion: null,
        }, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });

      if (lessonError) {
        errors.push(`Error insertando lección "${lesson.lessonTitle}": ${lessonError.message}`);
        console.error(`     ❌ Lección: ${lessonError.message}`);
      } else {
        lessonCount++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(50));
  console.log(`✅ Módulos insertados: ${moduleCount}`);
  console.log(`✅ Lecciones insertadas: ${lessonCount}`);

  if (errors.length > 0) {
    console.log(`❌ Errores: ${errors.length}`);
    errors.forEach((e) => console.log(`   - ${e}`));
  } else {
    console.log('🎉 Migración completada sin errores!');
  }
}

migrate().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});

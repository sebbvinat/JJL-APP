import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { listDriveFolderAll, listMainSubfolders } from '@/lib/google-drive';
import { requireCron } from '@/lib/cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Sincroniza la carpeta de Drive de cada alumno con video_uploads:
 * - Importa videos nuevos (idempotente por drive_file_id).
 * - Auto-vincula carpetas por nombre si el alumno no tiene drive_folder_id.
 * - Notifica a todos los admins por cada video nuevo.
 *
 * Logica compartida entre:
 *  - POST /api/admin/sync-drive-videos (admin manual desde /admin/reviews)
 *  - GET  /api/admin/sync-drive-videos (Vercel Cron diario; auth con CRON_SECRET)
 */
async function runSync(admin: SupabaseClient) {
  // Get students del programa (program_member=TRUE). Compradores de cursos
  // sueltos NO necesitan carpeta de Drive — no los escaneamos.
  type StudentRow = { id: string; nombre: string; drive_folder_id: string | null; rol: string; program_member?: boolean };
  let allStudents: StudentRow[] | null = null;
  let studentsErr: { message: string } | null = null;
  {
    const r = await admin
      .from('users')
      .select('id, nombre, drive_folder_id, rol, program_member')
      .neq('rol', 'admin')
      .eq('program_member', true);
    allStudents = (r.data as StudentRow[] | null);
    studentsErr = r.error;
  }
  // Fallback pre-migración (columna program_member todavia no existe).
  if (studentsErr && /column .* does not exist/i.test(studentsErr.message)) {
    const fb = await admin
      .from('users')
      .select('id, nombre, drive_folder_id, rol')
      .neq('rol', 'admin');
    allStudents = (fb.data as StudentRow[] | null);
    studentsErr = fb.error;
  }
  if (studentsErr) {
    console.error('[sync-drive] students query error', studentsErr);
    return { error: studentsErr.message, status: 500 } as const;
  }

  const studentList = allStudents || [];

  // Auto-link: for students without a folder, look for a subfolder in the
  // main JJL Drive folder whose name matches the student's name.
  const autoLinked: { nombre: string; folderId: string }[] = [];
  try {
    const subfolders = await listMainSubfolders();
    const norm = (s: string) =>
      s.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const folderByName = new Map<string, string>();
    subfolders.forEach((f) => {
      if (f.name && f.id) folderByName.set(norm(f.name), f.id);
    });
    for (const s of studentList as Array<{ id: string; nombre: string; drive_folder_id: string | null }>) {
      if (s.drive_folder_id) continue;
      const match = folderByName.get(norm(s.nombre));
      if (match) {
        await admin.from('users').update({ drive_folder_id: match }).eq('id', s.id);
        s.drive_folder_id = match;
        autoLinked.push({ nombre: s.nombre, folderId: match });
      }
    }
  } catch (err) {
    console.error('[sync-drive] auto-link failed', err);
  }

  // From here on we only process students with a folder (after auto-link).
  const students = studentList.filter((s: { drive_folder_id: string | null }) => !!s.drive_folder_id);

  if (students.length === 0) {
    return {
      imported: 0,
      message: 'No hay alumnos con carpeta de Drive vinculada. Pedile que entren a "Subir video" para crear su carpeta, o vinculala manualmente.',
      studentsWithFolder: 0,
      unlinkedStudents: studentList.map((s: { id: string; nombre: string }) => ({ id: s.id, nombre: s.nombre })),
      autoLinked,
    };
  }

  // Get existing drive_file_ids to skip duplicates
  const { data: existing } = await admin
    .from('video_uploads')
    .select('drive_file_id')
    .not('drive_file_id', 'is', null);

  const existingIds = new Set((existing || []).map((v: { drive_file_id: string }) => v.drive_file_id));

  // Pre-fetch los admins que reciben notifs de videos (tag 'profesor',
  // fallback a todos si nadie esta taggeado).
  const { getAdminsByTag } = await import('@/lib/admin-tags');
  const adminIds = await getAdminsByTag(admin, 'profesor');
  const { createNotification } = await import('@/lib/notifications');

  let imported = 0;
  const errors: string[] = [];
  const importedDetails: { nombre: string; count: number; files: string[] }[] = [];
  const scanDetails: {
    nombre: string;
    folderId: string;
    totalFiles: number;
    rawTotal: number;
    nonVideoNames: string[];
    subfolderNames: string[];
    newFiles: number;
    skippedFiles: number;
    fileNames: string[];
    skippedNames: string[];
    error?: string;
  }[] = [];

  for (const student of students as Array<{ id: string; nombre: string; drive_folder_id: string | null }>) {
    if (!student.drive_folder_id) continue;

    try {
      const driveResp = await listDriveFolderAll(student.drive_folder_id);
      const files = driveResp.videos;
      const newFiles = files.filter((f) => f.id && !existingIds.has(f.id));
      const skippedFiles = files.filter((f) => f.id && existingIds.has(f.id));

      scanDetails.push({
        nombre: student.nombre,
        folderId: student.drive_folder_id,
        totalFiles: files.length,
        rawTotal: driveResp.all.length,
        nonVideoNames: driveResp.nonVideos.map((f) => `${f.name || '(sin nombre)'} [${f.mimeType || 'unknown'}]`),
        subfolderNames: driveResp.folders.map((f) => f.name || '(sin nombre)'),
        newFiles: newFiles.length,
        skippedFiles: skippedFiles.length,
        fileNames: newFiles.map((f) => f.name || '(sin nombre)'),
        skippedNames: skippedFiles.map((f) => f.name || '(sin nombre)'),
      });

      if (newFiles.length === 0) continue;

      // Insert one-by-one so one bad row doesn't block others
      let insertedForStudent = 0;
      const insertedFileNames: string[] = [];
      for (const f of newFiles) {
        const row = {
          user_id: student.id,
          titulo: f.name || 'Video sin titulo',
          drive_file_id: f.id!,
          drive_url: f.webViewLink || null,
          file_size: f.size ? parseInt(f.size as string) : null,
          status: 'pendiente',
          created_at: f.createdTime || new Date().toISOString(),
        };

        const { error } = await admin.from('video_uploads').insert(row);
        if (error) {
          console.error('[sync-drive] insert error', { student: student.nombre, file: f.name, error });
          errors.push(`${student.nombre} / ${f.name}: ${error.message}`);
        } else {
          insertedForStudent++;
          insertedFileNames.push(f.name || 'Video sin titulo');

          // Notify all admins about THIS specific new video. Done per-file
          // so the bell shows one entry per video, not one bundled entry.
          try {
            await Promise.all(
              adminIds.map((aid) =>
                createNotification(
                  aid,
                  'system',
                  `Nuevo video de ${student.nombre}`,
                  f.name || 'Video sin titulo',
                  '/admin/reviews'
                )
              )
            );
          } catch (notifErr) {
            console.error('[sync-drive] notification failed', notifErr);
          }
        }
      }

      if (insertedForStudent > 0) {
        imported += insertedForStudent;
        importedDetails.push({ nombre: student.nombre, count: insertedForStudent, files: insertedFileNames });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync-drive] error for ${student.nombre}:`, err);
      errors.push(`${student.nombre}: ${msg}`);
      scanDetails.push({
        nombre: student.nombre,
        folderId: student.drive_folder_id!,
        totalFiles: 0,
        rawTotal: 0,
        nonVideoNames: [],
        subfolderNames: [],
        newFiles: 0,
        skippedFiles: 0,
        fileNames: [],
        skippedNames: [],
        error: msg,
      });
    }
  }

  return {
    success: true,
    imported,
    studentsScanned: students.length,
    studentsWithFolder: students.length,
    adminsNotified: adminIds.length,
    details: importedDetails,
    scanDetails,
    autoLinked,
    unlinkedStudents: studentList
      .filter((s: { drive_folder_id: string | null }) => !s.drive_folder_id)
      .map((s: { id: string; nombre: string }) => ({ id: s.id, nombre: s.nombre })),
    errors: errors.length > 0 ? errors : undefined,
  };
}

function adminSb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/admin/sync-drive-videos — admin only. Trigger manual desde
 * /admin/reviews. Requiere sesion de usuario con rol='admin'.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as { rol?: string } | null)?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const result = await runSync(adminSb());
  const status = (result as { error?: string; status?: number }).status;
  if (status) return NextResponse.json({ error: (result as { error?: string }).error }, { status });
  return NextResponse.json(result);
}

/**
 * GET /api/admin/sync-drive-videos — Vercel Cron diario. Detecta videos
 * nuevos en Drive aunque ningun admin abra /admin/reviews.
 * Auth: header `Authorization: Bearer ${CRON_SECRET}` (Vercel lo manda).
 */
export async function GET(request: NextRequest) {
  // Era la única ruta que NO usaba requireCron(): si CRON_SECRET no estaba
  // seteada no chequeaba nada y cualquiera disparaba un sync completo de
  // Drive. El helper falla cerrado y compara en tiempo constante.
  const deny = requireCron(request);
  if (deny) return deny;

  const result = await runSync(adminSb());
  const status = (result as { error?: string; status?: number }).status;
  if (status) return NextResponse.json({ error: (result as { error?: string }).error }, { status });
  return NextResponse.json(result);
}

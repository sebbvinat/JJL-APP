import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { listDriveFolderVideos } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/sync-drive-videos
 * Admin only. Scans every student's Drive folder and imports new videos
 * as pending uploads in video_uploads. Idempotent — skips existing.
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
  if ((profile as any)?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get all students with drive folders
  const { data: students, error: studentsErr } = await admin
    .from('users')
    .select('id, nombre, drive_folder_id')
    .not('drive_folder_id', 'is', null);

  if (studentsErr) {
    console.error('[sync-drive] students query error', studentsErr);
    return NextResponse.json({ error: studentsErr.message }, { status: 500 });
  }

  if (!students || students.length === 0) {
    return NextResponse.json({
      imported: 0,
      message: 'No hay alumnos con carpeta de Drive creada. Pedile a los alumnos que entren a "Subir video" para crear su carpeta.',
      studentsWithFolder: 0,
    });
  }

  // Get existing drive_file_ids to skip duplicates
  const { data: existing } = await admin
    .from('video_uploads')
    .select('drive_file_id')
    .not('drive_file_id', 'is', null);

  const existingIds = new Set((existing || []).map((v: any) => v.drive_file_id));

  let imported = 0;
  const errors: string[] = [];
  const importedDetails: { nombre: string; count: number }[] = [];
  const scanDetails: { nombre: string; folderId: string; totalFiles: number; newFiles: number; error?: string }[] = [];

  for (const student of students as Array<{ id: string; nombre: string; drive_folder_id: string | null }>) {
    if (!student.drive_folder_id) continue;

    try {
      const files = await listDriveFolderVideos(student.drive_folder_id);
      const newFiles = files.filter((f) => f.id && !existingIds.has(f.id));

      scanDetails.push({
        nombre: student.nombre,
        folderId: student.drive_folder_id,
        totalFiles: files.length,
        newFiles: newFiles.length,
      });

      if (newFiles.length === 0) continue;

      const rows = newFiles.map((f) => ({
        user_id: student.id,
        titulo: f.name || 'Video sin titulo',
        drive_file_id: f.id,
        drive_url: f.webViewLink,
        file_size: f.size ? parseInt(f.size as string) : null,
        status: 'pendiente',
        created_at: f.createdTime || new Date().toISOString(),
      }));

      const { error } = await admin.from('video_uploads').insert(rows);
      if (error) {
        errors.push(`${student.nombre}: ${error.message}`);
      } else {
        imported += newFiles.length;
        importedDetails.push({ nombre: student.nombre, count: newFiles.length });

        // Notify admins of new videos
        try {
          const { createNotification } = await import('@/lib/notifications');
          for (const f of newFiles) {
            // Notify all admins (including sync trigger)
            const { data: admins } = await admin.from('users').select('id').eq('rol', 'admin');
            for (const a of admins || []) {
              await createNotification(
                (a as any).id,
                'system',
                `Nuevo video de ${student.nombre}`,
                f.name || 'Video sin titulo',
                '/admin/reviews'
              );
            }
          }
        } catch {}
      }
    } catch (err: any) {
      console.error(`[sync-drive] error for ${student.nombre}:`, err);
      errors.push(`${student.nombre}: ${err.message || 'error'}`);
      scanDetails.push({
        nombre: student.nombre,
        folderId: student.drive_folder_id!,
        totalFiles: 0,
        newFiles: 0,
        error: err.message || String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    studentsScanned: students.length,
    details: importedDetails,
    scanDetails,
    errors: errors.length > 0 ? errors : undefined,
  });
}

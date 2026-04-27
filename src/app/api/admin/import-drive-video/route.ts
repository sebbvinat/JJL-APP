import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';
import { getDriveFileInfo } from '@/lib/google-drive';

export const runtime = 'nodejs';

// POST /api/admin/import-drive-video
// Body: { fileIdOrUrl: string, userId: string }
// Manually imports a single Drive video and assigns it to a student. Useful
// when sync can't see the file (permissions issue) but admin has the URL.
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as any)?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { fileIdOrUrl, userId } = await request.json();
  if (!fileIdOrUrl || !userId) {
    return NextResponse.json({ error: 'fileIdOrUrl y userId son requeridos' }, { status: 400 });
  }

  // Accept either a raw file ID or a Drive URL like
  // https://drive.google.com/file/d/<ID>/view or .../folders/<ID>
  const m = String(fileIdOrUrl).match(/[-\w]{25,}/);
  const fileId = m ? m[0] : null;
  if (!fileId) {
    return NextResponse.json({ error: 'No pude extraer el ID del link' }, { status: 400 });
  }

  let info;
  try {
    info = await getDriveFileInfo(fileId);
  } catch (err: any) {
    return NextResponse.json({
      error: `No se pudo leer el archivo en Drive: ${err.message || 'error'}. Asegurate de que la cuenta de servicio tenga acceso al archivo (compartir con el email de la service account).`,
    }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();

  // Avoid duplicates if it's already in the DB
  const { data: existing } = await admin
    .from('video_uploads')
    .select('id')
    .eq('drive_file_id', fileId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      error: 'Este video ya estaba importado',
      videoId: (existing as any).id,
    }, { status: 409 });
  }

  const { data: inserted, error } = await admin
    .from('video_uploads')
    .insert({
      user_id: userId,
      titulo: info.fileName || 'Video',
      drive_file_id: info.fileId || fileId,
      drive_url: info.webViewLink || null,
      status: 'pendiente',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify all admins so the new pending review shows up in their bell
  try {
    const [{ data: studentRow }, { data: admins }] = await Promise.all([
      admin.from('users').select('nombre').eq('id', userId).single(),
      admin.from('users').select('id').eq('rol', 'admin'),
    ]);
    const studentName = (studentRow as any)?.nombre || 'Alumno';
    const { createNotification } = await import('@/lib/notifications');
    await Promise.all(
      (admins || []).map((a: any) =>
        createNotification(
          a.id,
          'system',
          `Video importado de ${studentName}`,
          info.fileName || 'Video',
          '/admin/reviews'
        )
      )
    );
  } catch {}

  return NextResponse.json({ success: true, video: inserted });
}

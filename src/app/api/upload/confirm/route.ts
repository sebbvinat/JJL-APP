import { NextRequest, NextResponse } from 'next/server';
import { getDriveFileInfo } from '@/lib/google-drive';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// After the browser finishes uploading to Drive, this endpoint:
// 1. Fetches the file info (name, webViewLink) from Drive
// 2. Saves the video record in Supabase
// 3. Notifies all admins so they see the new pending review immediately
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { fileId, titulo, descripcion, fileSize } = await request.json();
    if (!fileId) {
      return NextResponse.json({ error: 'fileId requerido' }, { status: 400 });
    }

    // Get webViewLink from Drive
    const info = await getDriveFileInfo(fileId);

    // Save record
    const { error: insertError } = await supabase.from('video_uploads').insert({
      user_id: user.id,
      titulo: titulo || info.fileName || 'Video',
      descripcion: descripcion || null,
      drive_file_id: info.fileId || null,
      drive_url: info.webViewLink || null,
      file_size: fileSize || null,
      status: 'pendiente',
    });

    if (insertError) {
      console.error('[upload/confirm] insert failed', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Fire-and-forget admin notifications. Router: admins con tag 'profesor'
    // (fallback a todos si nadie esta taggeado todavia).
    try {
      const admin = createAdminSupabaseClient();
      const { data: profile } = await admin.from('users').select('nombre').eq('id', user.id).single();
      const uploaderName = (profile as { nombre?: string } | null)?.nombre || 'Un alumno';
      const videoName = titulo || info.fileName || 'Video sin titulo';
      const { createNotification } = await import('@/lib/notifications');
      const { getAdminsByTag } = await import('@/lib/admin-tags');
      const adminIds = await getAdminsByTag(admin, 'profesor');
      await Promise.all(
        adminIds.map((aid) =>
          createNotification(
            aid,
            'system',
            `Nuevo video de ${uploaderName}`,
            videoName,
            '/admin/reviews'
          )
        )
      );
    } catch (err) {
      console.error('[upload/confirm] notify admins failed', err);
    }

    return NextResponse.json({
      success: true,
      fileName: info.fileName,
      webViewLink: info.webViewLink,
    });
  } catch (err: any) {
    console.error('[upload/confirm] failed', err);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}

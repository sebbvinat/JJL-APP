import { NextRequest, NextResponse } from 'next/server';
import { getDriveFileInfo } from '@/lib/google-drive';
import { getAuthedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// After the browser finishes uploading to Drive, this endpoint:
// 1. Fetches the file info (name, webViewLink) from Drive
// 2. Saves the video record in Supabase
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

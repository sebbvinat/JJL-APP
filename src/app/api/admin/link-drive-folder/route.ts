import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/admin/link-drive-folder
// Body: { folderIdOrUrl: string, userId: string }
// Manually attaches a Drive folder to a student, so future syncs scan it.
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single();
  if ((profile as any)?.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { folderIdOrUrl, userId } = await request.json();
  if (!folderIdOrUrl || !userId) {
    return NextResponse.json({ error: 'folderIdOrUrl y userId son requeridos' }, { status: 400 });
  }

  // Accept full URL like https://drive.google.com/drive/folders/<ID>?usp=...
  const m = String(folderIdOrUrl).match(/[-\w]{25,}/);
  const folderId = m ? m[0] : null;
  if (!folderId) {
    return NextResponse.json({ error: 'No pude extraer el ID del link' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from('users')
    .update({
      drive_folder_id: folderId,
      drive_folder_url: `https://drive.google.com/drive/folders/${folderId}`,
    })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, folderId });
}

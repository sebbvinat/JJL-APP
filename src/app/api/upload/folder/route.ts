import { NextRequest, NextResponse } from 'next/server';
import { createDriveFolder } from '@/lib/google-drive';
import { getAuthedUser } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET: get or create the student's Drive folder
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Check if student already has a folder
    const { data: profile } = await supabase
      .from('users')
      .select('nombre, drive_folder_id, drive_folder_url')
      .eq('id', user.id)
      .single<{ nombre: string; drive_folder_id: string | null; drive_folder_url: string | null }>();

    if (profile?.drive_folder_id && profile?.drive_folder_url) {
      return NextResponse.json({
        folderId: profile.drive_folder_id,
        folderUrl: profile.drive_folder_url,
      });
    }

    // Create a new folder for this student
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ error: 'Google Drive no configurado' }, { status: 500 });
    }

    const folderName = profile?.nombre || 'Alumno';
    const folder = await createDriveFolder(folderName);

    // Save folder info to user profile (use admin client to bypass RLS)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await adminClient
      .from('users')
      .update({
        drive_folder_id: folder.folderId,
        drive_folder_url: folder.webViewLink,
      })
      .eq('id', user.id);

    return NextResponse.json({
      folderId: folder.folderId,
      folderUrl: folder.webViewLink,
    });
  } catch (err: any) {
    console.error('[upload/folder] failed', err);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}

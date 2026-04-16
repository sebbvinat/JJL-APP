import { NextRequest, NextResponse } from 'next/server';
import { createResumableUploadSession } from '@/lib/google-drive';
import { getAuthedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Generates a Google Drive resumable upload URL.
// The browser will PUT the file bytes directly to that URL,
// bypassing Vercel's 4.5MB request body limit.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users')
      .select('nombre')
      .eq('id', user.id)
      .single<{ nombre: string }>();

    const { fileName, mimeType, fileSize } = await request.json();
    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json({ error: 'Parametros faltantes' }, { status: 400 });
    }

    // Max 2GB to prevent abuse
    if (fileSize > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo demasiado grande (max 2GB)' }, { status: 400 });
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ error: 'Google Drive no configurado' }, { status: 500 });
    }

    const { uploadUrl, finalName } = await createResumableUploadSession(
      fileName,
      mimeType,
      profile?.nombre || 'Usuario',
      fileSize
    );

    return NextResponse.json({ uploadUrl, finalName });
  } catch (err: any) {
    console.error('[upload/session] failed', err);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}

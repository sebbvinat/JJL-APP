import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { uploadToDriveStream } from '@/lib/google-drive';
import { getAuthedUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('nombre')
      .eq('id', user.id)
      .single<{ nombre: string }>();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userName = profile?.nombre || 'Usuario';
    const titulo = (formData.get('titulo') as string) || '';
    const descripcion = (formData.get('descripcion') as string) || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No se recibio ningun archivo' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'El archivo excede el limite de 500MB' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({
        success: true,
        fileId: 'dev-' + Date.now(),
        fileName: file.name,
        webViewLink: '#',
        message: 'Upload simulado (Google Drive no configurado)',
      });
    }

    // Stream directly from the uploaded File to Google Drive without buffering
    // the whole file in memory. Vercel Hobby has a 256MB RAM limit — a 500MB
    // upload previously crashed the function.
    const webStream = file.stream() as unknown as ReadableStream<Uint8Array>;
    const nodeStream = Readable.fromWeb(webStream as any);

    const result = await uploadToDriveStream(
      nodeStream,
      file.name,
      file.type,
      userName
    );

    // Persist the upload so the coach sees pending reviews and the alumno
    // sees history + feedback. Failure here is logged but doesn't fail the
    // upload — the file already made it to Drive.
    const { error: insertError } = await supabase.from('video_uploads').insert({
      user_id: user.id,
      titulo: titulo || (result.fileName as string) || file.name,
      descripcion: descripcion || null,
      drive_file_id: result.fileId || null,
      drive_url: result.webViewLink || null,
      file_size: file.size,
      status: 'pendiente',
    });
    if (insertError) {
      console.error('[upload] video_uploads insert failed', insertError);
    }

    return NextResponse.json({
      success: true,
      ...result,
      titulo,
      descripcion,
    });
  } catch (error) {
    console.error('[upload] failed', error);
    return NextResponse.json(
      { error: 'Error al subir el archivo' },
      { status: 500 }
    );
  }
}

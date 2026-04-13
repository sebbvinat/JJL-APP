import { NextRequest, NextResponse } from 'next/server';
import { uploadToDrive } from '@/lib/google-drive';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userName = formData.get('userName') as string || 'Usuario';
    const titulo = formData.get('titulo') as string || '';
    const descripcion = formData.get('descripcion') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No se recibio ningun archivo' },
        { status: 400 }
      );
    }

    // Check file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo excede el limite de 500MB' },
        { status: 400 }
      );
    }

    // Check Google Drive is configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // Development mode: simulate upload
      return NextResponse.json({
        success: true,
        fileId: 'dev-' + Date.now(),
        fileName: file.name,
        webViewLink: '#',
        message: 'Upload simulado (Google Drive no configurado)',
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToDrive(buffer, file.name, file.type, userName);

    return NextResponse.json({
      success: true,
      ...result,
      titulo,
      descripcion,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Error al subir el archivo' },
      { status: 500 }
    );
  }
}

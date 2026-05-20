import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { listDriveFolderAll } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Carpeta "VIDEO ALUMNOS - GUIDO MAGALDI" en Drive. Para que esto funcione el
// service account de la app tiene que estar SHARED en esta carpeta (al menos
// con permiso de Viewer). El email del service account es el del JSON en
// GOOGLE_SERVICE_ACCOUNT_KEY (campo client_email). Si no está compartido,
// Drive devuelve lista vacía / 403 y el endpoint loguea el error.
const LLAMADAS_FOLDER_ID = '17s86Q5TmZHE197HbyHNkZTIS5h_H3L_5';

// GET /api/admin/llamadas
// Solo admins. Lista los videos (recursivo) de la carpeta de Drive con las
// llamadas 1 a 1. No expone IDs / metadata del service account.
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { videos } = await listDriveFolderAll(LLAMADAS_FOLDER_ID, { recursive: true });
    const out = videos.map((v) => ({
      id: v.id,
      name: v.name,
      webViewLink: v.webViewLink,
      thumbnailLink: v.thumbnailLink,
      createdTime: v.createdTime,
      modifiedTime: v.modifiedTime,
      size: v.size,
    }));
    // Más nuevas primero
    out.sort((a, b) => {
      const ta = a.createdTime ? Date.parse(a.createdTime) : 0;
      const tb = b.createdTime ? Date.parse(b.createdTime) : 0;
      return tb - ta;
    });
    return NextResponse.json({ videos: out });
  } catch (err) {
    logger.error('admin.llamadas.list.failed', { err });
    return NextResponse.json(
      {
        error:
          'No se pudo leer la carpeta de Drive. Verificá que el service account de la app esté shared en la carpeta de llamadas con permiso Viewer.',
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}

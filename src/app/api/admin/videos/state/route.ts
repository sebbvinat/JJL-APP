import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/videos/state
 *
 * Trae el estado actual de overrides de video para el editor admin de
 * `/admin/videos`. Devuelve TODOS los overrides en una sola llamada —
 * la planilla activa la elige el cliente. Como `lesson_video_overrides`
 * es chiquita (<1000 filas) traerla entera es más rápido que filtrar.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { admin } = ctx;

  const { data, error } = await admin
    .from('lesson_video_overrides')
    .select('module_id, lesson_key, youtube_id, titulo, descripcion, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ overrides: [], setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ overrides: data || [] });
}

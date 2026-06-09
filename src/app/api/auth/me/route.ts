import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/auth/me
 *
 * Devuelve el perfil del usuario admin autenticado actual.
 * Lo usa /admin/agendas para decidir si mostrarle la guía del setter
 * (basado en tags + setter_guide_seen_at).
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user, admin } = ctx;

  const { data, error } = await admin
    .from('users')
    .select('id, nombre, tags, setter_guide_seen_at')
    .eq('id', user.id)
    .single();

  // 2min de cache + SWR 10min. El perfil del admin rarísimo cambia mid-sesión.
  const cacheHeaders = {
    'Cache-Control': 'private, max-age=120, stale-while-revalidate=600',
  };

  if (error) {
    // Pre-migración: columna setter_guide_seen_at puede no existir todavía
    if (/column .* does not exist/i.test(error.message)) {
      const { data: fallback } = await admin
        .from('users')
        .select('id, nombre, tags')
        .eq('id', user.id)
        .single();
      return NextResponse.json({ user: fallback }, { headers: cacheHeaders });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data }, { headers: cacheHeaders });
}

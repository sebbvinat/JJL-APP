import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/admin/setter/guide-seen
 *
 * Marca que el setter actual vio la guía de bienvenida en /admin/agendas
 * — el modal no se vuelve a mostrar a este usuario.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { user, admin } = ctx;

  const { error } = await admin
    .from('users')
    .update({ setter_guide_seen_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      // Pre-migración: silently OK — la columna llega pronto.
      return NextResponse.json({ success: true, setupRequired: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

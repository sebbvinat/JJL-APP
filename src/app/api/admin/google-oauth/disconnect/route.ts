import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { deleteOAuthToken } from '@/lib/google-oauth';

export const runtime = 'nodejs';

/**
 * POST /api/admin/google-oauth/disconnect — admin only.
 * Borra el refresh token guardado. Las próximas operaciones caen al
 * service account (que sigue fallando con 403 en uploads, pero
 * lectura/sync sigue andando).
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    await deleteOAuthToken();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error' }, { status: 500 });
  }
}

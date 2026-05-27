import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { loadOAuthToken } from '@/lib/google-oauth';

export const runtime = 'nodejs';

/**
 * GET /api/admin/google-oauth/status — admin only.
 * Indica si hay un refresh token guardado y el email de la cuenta.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const hasClientId = !!process.env.GOOGLE_OAUTH_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const token = await loadOAuthToken();

  return NextResponse.json({
    configured: hasClientId && hasClientSecret,
    has_client_id: hasClientId,
    has_client_secret: hasClientSecret,
    connected: !!token,
    email: token?.email || null,
    connected_at: token?.connected_at || null,
  });
}

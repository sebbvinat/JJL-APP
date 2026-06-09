import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/announcements — anuncios activos no descartados por este usuario,
// no vencidos. Orden: criticos > warning > info, luego mas nuevos primero.
export async function GET(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ announcements: [] });

  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from('announcements')
    .select('id, titulo, mensaje, importancia, url, created_at, expires_at')
    .eq('activa', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ announcements: [] });
    }
    return NextResponse.json({ announcements: [], error: error.message });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { announcements: [] },
      { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } },
    );
  }

  const { data: dismissals } = await admin
    .from('announcement_dismissals')
    .select('announcement_id')
    .eq('user_id', user.id);
  const dismissedSet = new Set((dismissals || []).map((d: { announcement_id: string }) => d.announcement_id));

  const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const active = data
    .filter((a) => !dismissedSet.has(a.id))
    .sort((a, b) => {
      const r = (rank[a.importancia] ?? 9) - (rank[b.importancia] ?? 9);
      if (r !== 0) return r;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

  return NextResponse.json(
    { announcements: active },
    {
      // Anuncios cambian raro — vale cachear 1min con SWR de 5min.
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
    },
  );
}

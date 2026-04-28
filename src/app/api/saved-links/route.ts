import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { classifyTopic, hostOf, type LibraryTopic } from '@/lib/library-topics';

export const runtime = 'nodejs';

function detectSource(host: string): string {
  const h = host.toLowerCase();
  if (h.includes('instagram')) return 'instagram';
  if (h.includes('tiktok')) return 'tiktok';
  if (h.includes('youtube') || h.includes('youtu.be')) return 'youtube';
  return 'other';
}

// GET /api/saved-links?status=pending
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  let q = supabase
    .from('saved_links')
    .select('id, url, source, titulo, notas, thumbnail_url, topic, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

// POST /api/saved-links
// Body: { url, titulo?, notas?, topic?, thumbnail_url? }
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  let raw = String(body.url || '').trim();
  if (!raw) return NextResponse.json({ error: 'URL requerida' }, { status: 400 });

  // Allow text-with-url-inside (Instagram share sheet sometimes sends "Check this https://...")
  const m = raw.match(/https?:\/\/[^\s]+/i);
  if (m) raw = m[0];
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  const host = hostOf(raw);
  const source = detectSource(host);
  const topic: LibraryTopic =
    body.topic || classifyTopic(`${body.titulo || ''} ${body.notas || ''}`);

  const { data, error } = await supabase
    .from('saved_links')
    .insert({
      user_id: user.id,
      url: raw,
      source,
      titulo: body.titulo || null,
      notas: body.notas || null,
      thumbnail_url: body.thumbnail_url || null,
      topic,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

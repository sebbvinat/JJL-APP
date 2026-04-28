import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { classifyTopic, type LibraryTopic } from '@/lib/library-topics';

export const runtime = 'nodejs';

// GET /api/techniques?topic=guardia
// Returns the current user's personal techniques, optionally filtered by topic.
export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(request.url);
  const topic = url.searchParams.get('topic');

  let q = supabase
    .from('personal_techniques')
    .select('id, nombre, topic, notas, steps, photos, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (topic && topic !== 'all') q = q.eq('topic', topic);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ techniques: data || [] });
}

// POST /api/techniques
// Body: { nombre, topic?, notas?, steps?, photos? }
// If topic is missing, auto-classify from nombre + notas using library-topics regex.
export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nombre = (body.nombre || '').trim();
  if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const topic: LibraryTopic = body.topic || classifyTopic(`${nombre} ${body.notas || ''}`);
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const photos = Array.isArray(body.photos) ? body.photos : [];

  const { data, error } = await supabase
    .from('personal_techniques')
    .insert({
      user_id: user.id,
      nombre,
      topic,
      notas: body.notas || null,
      steps,
      photos,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ technique: data });
}

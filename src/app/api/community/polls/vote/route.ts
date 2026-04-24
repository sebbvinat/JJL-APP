import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
}

// POST: vote on a poll (toggle). Body: { pollId, opcionId }
export async function POST(request: NextRequest) {
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { pollId, opcionId } = await request.json();
  if (!pollId || !opcionId) return NextResponse.json({ error: 'Datos faltantes' }, { status: 400 });

  // Get poll to check if multiple
  const { data: poll } = await supabase
    .from('post_polls')
    .select('multiple')
    .eq('id', pollId)
    .single();

  if (!poll) return NextResponse.json({ error: 'Poll no encontrada' }, { status: 404 });

  const isMultiple = (poll as any).multiple;

  // Check existing vote
  const { data: existing } = await supabase
    .from('post_poll_votes')
    .select('id, opcion_id')
    .eq('poll_id', pollId)
    .eq('user_id', user.id);

  const alreadyVotedThisOption = (existing || []).some((v: any) => v.opcion_id === opcionId);

  if (alreadyVotedThisOption) {
    // Toggle off: remove this specific vote
    await supabase
      .from('post_poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', user.id)
      .eq('opcion_id', opcionId);
    return NextResponse.json({ success: true, action: 'removed' });
  }

  // If not multiple, remove other votes first
  if (!isMultiple && existing && existing.length > 0) {
    await supabase
      .from('post_poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', user.id);
  }

  // Insert new vote
  const { error } = await supabase
    .from('post_poll_votes')
    .insert({ poll_id: pollId, user_id: user.id, opcion_id: opcionId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, action: 'voted' });
}

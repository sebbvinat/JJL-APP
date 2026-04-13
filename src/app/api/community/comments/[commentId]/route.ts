import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getSupabase(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

// DELETE: Delete a comment (owner or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const supabase = getSupabase(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.rol === 'admin';

  // Get the comment to find its post_id
  const { data: comment } = await supabase
    .from('comments')
    .select('id, user_id, post_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Only owner or admin can delete
  if (comment.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Use service role if admin deleting someone else's comment
  if (isAdmin && comment.user_id !== user.id) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'No service role key' }, { status: 500 });
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await adminClient.from('comments').delete().eq('id', commentId);
    await adminClient.rpc('decrement_comments', { p_post_id: comment.post_id }).maybeSingle();
  } else {
    await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
    await supabase.rpc('decrement_comments', { p_post_id: comment.post_id }).maybeSingle();
  }

  return NextResponse.json({ success: true });
}

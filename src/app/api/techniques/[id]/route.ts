import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface Ctx { params: Promise<{ id: string }> }

// GET /api/techniques/:id
export async function GET(request: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await supabase
    .from('personal_techniques')
    .select('id, nombre, topic, notas, steps, photos, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ technique: data });
}

// PATCH /api/techniques/:id
// Body: any subset of { nombre, topic, notas, steps, photos }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.nombre === 'string') update.nombre = body.nombre.trim();
  if (typeof body.topic === 'string') update.topic = body.topic;
  if (typeof body.notas === 'string' || body.notas === null) update.notas = body.notas;
  if (Array.isArray(body.steps)) update.steps = body.steps;
  if (Array.isArray(body.photos)) update.photos = body.photos;

  const { data, error } = await supabase
    .from('personal_techniques')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ technique: data });
}

// DELETE /api/techniques/:id
// Also best-effort deletes photos from storage.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  // Pull photo URLs first so we can clean up storage after the row is gone.
  const { data: existing } = await supabase
    .from('personal_techniques')
    .select('photos, steps')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  const { error } = await supabase
    .from('personal_techniques')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: remove photo objects from the bucket. Use service role so we
  // don't depend on RLS for object deletes.
  try {
    const urls: string[] = [];
    const photos = (existing as any)?.photos || [];
    const steps = (existing as any)?.steps || [];
    for (const p of photos) if (p?.url) urls.push(p.url);
    for (const s of steps) if (s?.photo_url) urls.push(s.photo_url);

    const objectPaths = urls
      .map((u) => {
        const m = u.match(/\/storage\/v1\/object\/public\/technique-photos\/(.+)$/);
        return m ? m[1] : null;
      })
      .filter(Boolean) as string[];

    if (objectPaths.length > 0) {
      const admin = createAdminSupabaseClient();
      await admin.storage.from('technique-photos').remove(objectPaths);
    }
  } catch (err) {
    console.error('[techniques.delete] photo cleanup failed', err);
  }

  return NextResponse.json({ success: true });
}

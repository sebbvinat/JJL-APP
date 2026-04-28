import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface Ctx { params: Promise<{ id: string }> }

// POST /api/techniques/:id/photo
// Multipart form: { file: File }
// Uploads to technique-photos bucket under {user_id}/{technique_id}/{ts}-{name}
// Returns the public URL.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  // Verify the technique belongs to the user (RLS would block update later anyway,
  // but we want to fail fast with a clear error).
  const { data: tech } = await supabase
    .from('personal_techniques')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!tech) return NextResponse.json({ error: 'Técnica no encontrada' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file requerido' }, { status: 400 });
  }

  const original = (file as any).name || 'photo.jpg';
  const safeName = original.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${user.id}/${id}/${Date.now()}-${safeName}`;

  // Upload via service role so we don't fight RLS — we already verified ownership.
  const admin = createAdminSupabaseClient();
  const arrayBuf = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from('technique-photos')
    .upload(path, Buffer.from(arrayBuf), {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = admin.storage.from('technique-photos').getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path });
}

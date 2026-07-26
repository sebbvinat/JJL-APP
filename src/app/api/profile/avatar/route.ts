import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser, createAdminSupabaseClient } from '@/lib/supabase/server';
import { imageExtFor } from '@/lib/upload-types';

export async function POST(request: NextRequest) {
  const { user } = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('avatar') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 });
  }

  // La extensión sale de un whitelist por MIME, nunca de file.name (que es
  // texto del atacante y permitía escribir fuera de la carpeta).
  const ext = imageExtFor(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: 'Formato no permitido. Usá JPG, PNG o WEBP.' },
      { status: 400 },
    );
  }
  const filePath = `${user.id}.${ext}`;

  // Use service role for storage upload (bypasses RLS)
  const adminClient = createAdminSupabaseClient();

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await adminClient.storage
    .from('avatars')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('Avatar upload error:', uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = adminClient.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update user profile (use admin client to bypass RLS)
  const { error: updateError } = await adminClient
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);

  if (updateError) {
    console.error('Profile update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}

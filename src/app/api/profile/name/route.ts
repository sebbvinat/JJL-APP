import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { nombre } = await request.json().catch(() => ({}));
  const trimmed = typeof nombre === 'string' ? nombre.trim() : '';
  if (!trimmed) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  if (trimmed.length > 80) return NextResponse.json({ error: 'Nombre demasiado largo' }, { status: 400 });

  const { error } = await supabase.from('users').update({ nombre: trimmed }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, nombre: trimmed });
}

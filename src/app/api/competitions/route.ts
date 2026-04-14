import { NextResponse, type NextRequest } from 'next/server';
import { getAuthedUser } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface CompetitionInput {
  id?: string;
  nombre: string;
  fecha: string;
  lugar?: string | null;
  categoria?: string | null;
  modalidad?: string | null;
  importancia?: 'baja' | 'normal' | 'alta';
  resultado?: string | null;
  notas?: string | null;
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data } = await supabase
    .from('competitions')
    .select('*')
    .eq('user_id', user.id)
    .order('fecha', { ascending: true });

  return NextResponse.json({ competitions: data || [] });
}

export async function POST(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = (await request.json()) as CompetitionInput;
  if (!body.nombre || !body.fecha) {
    return NextResponse.json({ error: 'nombre y fecha son requeridos' }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    nombre: body.nombre.trim(),
    fecha: body.fecha,
    lugar: body.lugar || null,
    categoria: body.categoria || null,
    modalidad: body.modalidad || null,
    importancia: body.importancia || 'normal',
    resultado: body.resultado || null,
    notas: body.notas || null,
  };

  if (body.id) {
    const { data, error } = await supabase
      .from('competitions')
      .update(payload)
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) {
      logger.error('competitions.update.failed', { err: error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ competition: data });
  }

  const { data, error } = await supabase
    .from('competitions')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    logger.error('competitions.insert.failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ competition: data });
}

export async function DELETE(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabase
    .from('competitions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    logger.error('competitions.delete.failed', { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

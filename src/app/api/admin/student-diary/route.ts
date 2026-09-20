import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Auth centralizada: el diario es de lo más privado que escribe un alumno. A
  // mano solo se miraba `rol === 'admin'`, que el setter cumple (rol='admin' +
  // tag). `verificarAdmin` lo rechaza por defecto y mantiene los mismos
  // códigos: 401 sin sesión, 403 sin permiso.
  const auth = await verificarAdmin(request);
  if (!auth.ctx) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const studentId = request.nextUrl.searchParams.get('userId');
  if (!studentId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

  const admin = auth.ctx.admin;

  const { data: entries } = await admin
    .from('daily_tasks')
    .select('*')
    .eq('user_id', studentId)
    .order('fecha', { ascending: false })
    .limit(30);

  const { data: student } = await admin
    .from('users')
    .select('nombre')
    .eq('id', studentId)
    .single();

  return NextResponse.json({
    entries: entries || [],
    studentName: student?.nombre || 'Alumno',
  });
}

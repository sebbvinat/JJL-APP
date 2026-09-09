import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';

/**
 * GET /api/admin/setter/quiz-leads
 *
 * La gente que paso por el quiz "A que luchador te pareces", con su contacto.
 *
 * Incluye a los que NO terminaron. Antes la fila se creaba recien al calcular
 * el resultado, asi que el que abandonaba a mitad no existia para nosotros;
 * ahora se crea apenas carga el contacto y esos son justamente los que hay
 * que ir a buscar a mano.
 *
 * Va bajo /api/admin/setter/ porque ese prefijo ya esta en la whitelist del
 * middleware y el setter lo tiene que poder leer.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { data, error } = await auth.admin
    .from('match_quiz_responses')
    .select(
      'session_id, nombre, instagram, whatsapp, match_arquetipo, match_pct, vision, dolor, frecuencia, peso, clicked_form, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[quiz-leads] fallo la lectura', error);
    return NextResponse.json({ error: 'No se pudo leer el quiz' }, { status: 500 });
  }

  const items = (data ?? []).map((r) => ({
    ...r,
    // Sin arquetipo = no llego al final.
    completo: !!r.match_arquetipo,
  }));

  return NextResponse.json(
    {
      items,
      total: items.length,
      incompletos: items.filter((i) => !i.completo).length,
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}

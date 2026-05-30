import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { MONTH_RANGES } from '@/lib/crm';

/**
 * POST /api/admin/students/bulk
 * Body: { userIds: string[], action: 'unlock_month'|'lock_month'|'tag'|'lifecycle'|'announce', payload: ... }
 *
 * unlock_month / lock_month payload: { mes: number }
 *   Toggle is_unlocked en user_access para los módulos del mes en course_data
 *   de cada alumno. Solo afecta módulos que el alumno ya tiene en course_data.
 *
 * tag payload: { tag: string, mode: 'add'|'remove' }
 *   Mutación atómica del array users.tags por alumno.
 *
 * lifecycle payload: { lifecycle_stage: 'active'|'at_risk'|... }
 *
 * announce payload: { titulo: string, mensaje: string, url?: string }
 *   createNotification (in-app + push) para cada alumno.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireAdmin(request);
  if (!ctx) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds.filter((s: unknown) => typeof s === 'string' && s.length > 0) : [];
  const action: string = String(body?.action || '');
  const payload = body?.payload || {};

  if (userIds.length === 0) return NextResponse.json({ error: 'userIds vacío' }, { status: 400 });
  if (userIds.length > 200) return NextResponse.json({ error: 'demasiados userIds (max 200)' }, { status: 400 });

  const admin = ctx.admin;

  switch (action) {
    case 'unlock_month':
    case 'lock_month': {
      const mes = typeof payload?.mes === 'number' ? payload.mes : null;
      if (mes === null) return NextResponse.json({ error: 'payload.mes requerido' }, { status: 400 });
      const block = MONTH_RANGES.find((b) => b.mes === mes);
      if (!block) return NextResponse.json({ error: 'mes invalido' }, { status: 400 });

      const isUnlock = action === 'unlock_month';
      let affected = 0;
      for (const uid of userIds) {
        const { data: courseRows } = await admin
          .from('course_data')
          .select('module_id, semana_numero')
          .eq('user_id', uid)
          .in('semana_numero', block.semanas);
        const moduleIds = ((courseRows as { module_id: string }[] | null) || []).map((r) => r.module_id);
        if (moduleIds.length === 0) continue;
        // No incluimos unlocked_at acá porque la DB de prod no tiene esa
        // columna en algunos entornos (PostgREST tira "column not found
        // in schema cache"). El campo is_unlocked es lo unico que importa
        // para la lógica de acceso.
        const rows = moduleIds.map((module_id) => ({
          user_id: uid,
          module_id,
          is_unlocked: isUnlock,
        }));
        const { error } = await admin.from('user_access').upsert(rows, { onConflict: 'user_id,module_id' });
        if (!error) affected += moduleIds.length;
      }
      return NextResponse.json({ success: true, affected_modules: affected, action, mes });
    }

    case 'tag': {
      const tag: string = String(payload?.tag || '').toLowerCase().trim();
      const mode: 'add' | 'remove' = payload?.mode === 'remove' ? 'remove' : 'add';
      if (!tag) return NextResponse.json({ error: 'payload.tag requerido' }, { status: 400 });

      const { data: rows } = await admin.from('users').select('id, tags').in('id', userIds);
      let updated = 0;
      for (const r of (rows as { id: string; tags: string[] | null }[] | null) || []) {
        const current = r.tags || [];
        const next = mode === 'add'
          ? (current.includes(tag) ? current : [...current, tag])
          : current.filter((t) => t !== tag);
        if (JSON.stringify(current) === JSON.stringify(next)) continue;
        const { error } = await admin.from('users').update({ tags: next }).eq('id', r.id);
        if (!error) updated++;
      }
      return NextResponse.json({ success: true, updated, action, tag, mode });
    }

    case 'lifecycle': {
      const lifecycle: string = String(payload?.lifecycle_stage || '');
      const allowed = new Set(['prospect', 'onboarding', 'active', 'at_risk', 'paused', 'churned']);
      if (!allowed.has(lifecycle)) return NextResponse.json({ error: 'lifecycle_stage invalido' }, { status: 400 });
      const { error } = await admin
        .from('users')
        .update({ lifecycle_stage: lifecycle, lifecycle_changed_at: new Date().toISOString() })
        .in('id', userIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, updated: userIds.length, lifecycle });
    }

    case 'announce': {
      const titulo: string = String(payload?.titulo || '').trim();
      const mensaje: string = String(payload?.mensaje || '').trim();
      const url: string | null = payload?.url ? String(payload.url) : null;
      if (!titulo || !mensaje) return NextResponse.json({ error: 'titulo y mensaje requeridos' }, { status: 400 });
      try {
        const { createNotification } = await import('@/lib/notifications');
        let sent = 0;
        for (const uid of userIds) {
          await createNotification(uid, 'system', titulo, mensaje.slice(0, 200), url || '/dashboard');
          sent++;
        }
        return NextResponse.json({ success: true, sent });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'error';
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: 'action invalida' }, { status: 400 });
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { format, subMonths } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';
import { classifyTopic, extractLinks, hostOf, type LibraryTopic } from '@/lib/library-topics';

/**
 * Library endpoint — flatten months of journal entries into searchable
 * items grouped by topic.
 *
 *   ?months=6   → how far back to look (default 6, cap 12).
 *
 * Returns two views built from the same dataset:
 *   - entries[]  : every non-empty aprendizajes/observaciones/notas, each
 *                  tagged with its classified topic.
 *   - links[]    : URLs extracted from notas (and aprendizajes/
 *                  observaciones too, cheap enough), each with host and
 *                  the fecha it came from.
 *   - byTopic    : counts per topic for the filter chips.
 */

interface TaskRow {
  fecha: string;
  aprendizajes: string | null;
  observaciones: string | null;
  notas: string | null;
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const monthsParam = Number(request.nextUrl.searchParams.get('months')) || 6;
  const months = Math.min(Math.max(monthsParam, 1), 12);
  const from = format(subMonths(new Date(), months), 'yyyy-MM-dd');

  const { data } = await supabase
    .from('daily_tasks')
    .select('fecha, aprendizajes, observaciones, notas')
    .eq('user_id', user.id)
    .gte('fecha', from)
    .or('aprendizajes.not.is.null,observaciones.not.is.null,notas.not.is.null')
    .order('fecha', { ascending: false });

  const rows = (data as TaskRow[] | null) || [];

  type EntryKind = 'aprendizaje' | 'observacion' | 'nota';
  interface Entry {
    fecha: string;
    kind: EntryKind;
    text: string;
    topic: LibraryTopic;
  }
  interface Link {
    fecha: string;
    url: string;
    host: string;
    context: string;
    topic: LibraryTopic;
  }

  const entries: Entry[] = [];
  const links: Link[] = [];
  const byTopic: Record<LibraryTopic, number> = {
    submission: 0,
    pasaje: 0,
    guardia: 0,
    montada: 0,
    espalda: 0,
    costado: 0,
    defensa: 0,
    takedown: 0,
    competencia: 0,
    otro: 0,
  };

  function pushEntry(fecha: string, kind: EntryKind, text: string | null) {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const topic = classifyTopic(trimmed);
    entries.push({ fecha, kind, text: trimmed, topic });
    byTopic[topic]++;

    for (const url of extractLinks(trimmed)) {
      // Context: 60 chars before the URL, trimmed to a clean word boundary.
      const idx = trimmed.indexOf(url);
      const before = trimmed.slice(Math.max(0, idx - 80), idx).trim();
      const after = trimmed
        .slice(idx + url.length, idx + url.length + 80)
        .trim();
      const context = (before + (after ? ' … ' + after : '')).trim();
      links.push({ fecha, url, host: hostOf(url), context, topic });
    }
  }

  for (const row of rows) {
    pushEntry(row.fecha, 'aprendizaje', row.aprendizajes);
    pushEntry(row.fecha, 'observacion', row.observaciones);
    pushEntry(row.fecha, 'nota', row.notas);
  }

  return NextResponse.json({
    months,
    from,
    counts: {
      entries: entries.length,
      links: links.length,
    },
    byTopic,
    entries,
    links,
  });
}

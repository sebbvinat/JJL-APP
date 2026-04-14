import { NextResponse, type NextRequest } from 'next/server';
import { format, subMonths } from 'date-fns';
import { getAuthedUser } from '@/lib/supabase/server';
import { classifyTopic, extractLinks, hostOf, type LibraryTopic } from '@/lib/library-topics';

/**
 * Library view — reads from journal_entries. Each row becomes one library
 * entry (tagged with its classified topic). Links are extracted from every
 * entry's text and surfaced in a separate `links` array.
 *
 *   ?months=6 (default, cap 12) → how far back to include. Standalone
 *                                  entries (fecha = NULL) are always included.
 */

interface RowJE {
  id: string;
  kind: 'aprendizaje' | 'observacion' | 'nota';
  text: string;
  fecha: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const monthsParam = Number(request.nextUrl.searchParams.get('months')) || 6;
  const months = Math.min(Math.max(monthsParam, 1), 12);
  const from = format(subMonths(new Date(), months), 'yyyy-MM-dd');

  const { data } = await supabase
    .from('journal_entries')
    .select('id, kind, text, fecha, created_at')
    .eq('user_id', user.id)
    .or(`fecha.gte.${from},fecha.is.null`)
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (data as RowJE[] | null) || [];

  interface Entry {
    id: string;
    fecha: string;
    kind: RowJE['kind'];
    text: string;
    topic: LibraryTopic;
  }
  interface Link {
    id: string;
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

  for (const row of rows) {
    const topic = classifyTopic(row.text);
    // Use created_at date for standalone entries so they sort into the
    // library timeline naturally.
    const effectiveFecha = row.fecha || row.created_at.slice(0, 10);
    entries.push({
      id: row.id,
      fecha: effectiveFecha,
      kind: row.kind,
      text: row.text,
      topic,
    });
    byTopic[topic]++;

    for (const url of extractLinks(row.text)) {
      const idx = row.text.indexOf(url);
      const before = row.text.slice(Math.max(0, idx - 80), idx).trim();
      const after = row.text.slice(idx + url.length, idx + url.length + 80).trim();
      const context = (before + (after ? ' … ' + after : '')).trim();
      links.push({
        id: row.id,
        fecha: effectiveFecha,
        url,
        host: hostOf(url),
        context,
        topic,
      });
    }
  }

  return NextResponse.json({
    months,
    from,
    counts: { entries: entries.length, links: links.length },
    byTopic,
    entries,
    links,
  });
}

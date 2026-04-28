'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Save, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { TOPIC_LABELS, hostOf, type LibraryTopic } from '@/lib/library-topics';

// Landing page for the PWA share_target. Android Chrome will route share-sheet
// intents from Instagram/TikTok/YouTube here as ?text=<url> (or ?url=<url>).
// We pre-fill a small form, the user can add notes + pick a topic, then save.
export default function ShareSavePage() {
  return (
    <Suspense fallback={null}>
      <ShareSavePageInner />
    </Suspense>
  );
}

function ShareSavePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const calledOnce = useRef(false);

  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [notas, setNotas] = useState('');
  const [topic, setTopic] = useState<LibraryTopic>('otro');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;
    const incomingUrl = params.get('url') || '';
    const incomingText = params.get('text') || '';
    const incomingTitle = params.get('title') || '';

    // The share text often contains the URL; extract it.
    const candidate =
      incomingUrl ||
      incomingText.match(/https?:\/\/[^\s]+/)?.[0] ||
      incomingText ||
      '';
    setUrl(candidate);
    if (incomingTitle) setTitulo(incomingTitle);
  }, [params]);

  async function save() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/saved-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, titulo: titulo.trim() || null, notas: notas.trim() || null, topic }),
      });
      if (!res.ok) throw new Error('save_failed');
      toast.success('Guardado en Para Probar');
      router.push('/library?tab=probar');
    } catch {
      toast.error('No pudimos guardar');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-6 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1.5">
          Guardar para probar
        </p>
        <h1 className="text-2xl font-black tracking-tight">Nuevo link</h1>
        <p className="text-sm text-jjl-muted mt-1">Lo agregamos a tu lista &quot;Para Probar&quot;.</p>
      </div>

      <Card>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
            {url && <p className="text-[11px] text-jjl-muted mt-1">{hostOf(url)}</p>}
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Titulo (opcional)
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. De la Riva sweep de Lachlan Giles"
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Que probar, contra quien, detalles..."
              rows={3}
              className="w-full px-3 py-2.5 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">
              Categoria
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as LibraryTopic)}
              className="w-full h-10 px-3 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white focus:outline-none focus:border-jjl-red"
            >
              {(Object.entries(TOPIC_LABELS) as Array<[LibraryTopic, string]>).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="primary" onClick={save} loading={saving} disabled={!url.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => router.push('/library')}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Video, Search, ChevronDown } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import { MOCK_MODULES, MOCK_LESSONS, type MockLesson } from '@/lib/mock-data';

// Extract a YouTube video id from the user's input — accepts:
//   11-char id, full watch?v=..., youtu.be/..., embed/..., shorts/...
function normalizeYoutubeId(input: string): string {
  const s = input.trim();
  if (!s) return '';
  // Match the 11-char id after known URL shapes
  const m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/
  );
  if (m) return m[1];
  // Raw 11-char id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return s; // let server accept whatever — validation is soft
}

export default function AdminVideosPage() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['mod-0']));

  const q = query.trim().toLowerCase();
  const filteredModules = useMemo(() => {
    if (!q) return MOCK_MODULES;
    return MOCK_MODULES.filter((m) => {
      if (m.titulo.toLowerCase().includes(q)) return true;
      const lessons = MOCK_LESSONS[m.id] || [];
      return lessons.some((l) => l.titulo.toLowerCase().includes(q));
    });
  }, [q]);

  function toggle(moduleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">
              Admin
            </p>
            <h1 className="text-2xl font-black tracking-tight">Editor de videos</h1>
            <p className="text-sm text-jjl-muted mt-0.5">
              Cambia los links de YouTube — el cambio se aplica a todos tus alumnos al toque.
            </p>
          </div>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar modulo o leccion..."
          className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-lg text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
      </div>

      <div className="space-y-2">
        {filteredModules.map((mod) => {
          const lessons = (MOCK_LESSONS[mod.id] || []).filter((l) => l.tipo !== 'reflection');
          const isOpen = expanded.has(mod.id);
          return (
            <div
              key={mod.id}
              className="rounded-xl border border-jjl-border bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => toggle(mod.id)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="inline-flex h-8 px-2 items-center rounded-md bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-[10px] font-bold uppercase tracking-[0.14em] shrink-0">
                  {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">{mod.titulo}</p>
                  <p className="text-[11px] text-jjl-muted">{lessons.length} videos</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-jjl-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-jjl-border/60 bg-black/20 p-3 space-y-2 animate-slide-down">
                  {lessons.map((lesson) => (
                    <LessonRow key={lesson.id} moduleId={mod.id} lesson={lesson} />
                  ))}
                  {lessons.length === 0 && (
                    <p className="text-[12px] text-jjl-muted italic py-3 text-center">
                      Sin videos en este modulo.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredModules.length === 0 && (
          <Card>
            <p className="text-center py-8 text-[13px] text-jjl-muted">
              No hay modulos que coincidan con &quot;{q}&quot;.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function LessonRow({
  moduleId,
  lesson,
}: {
  moduleId: string;
  lesson: MockLesson;
}) {
  const [value, setValue] = useState(lesson.youtube_id || '');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(lesson.youtube_id || '');
  const [result, setResult] = useState<{ updated: number } | null>(null);
  const toast = useToast();

  const normalized = normalizeYoutubeId(value);
  const changed = normalized !== lastSaved;
  const isValid = /^[a-zA-Z0-9_-]{11}$/.test(normalized);

  async function save() {
    if (!changed) return;
    if (!isValid) {
      toast.error('El ID de YouTube debe tener 11 caracteres.');
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/update-lesson-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: moduleId,
          lesson_id: lesson.id,
          youtube_id: normalized,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Error al guardar');
      setLastSaved(normalized);
      setValue(normalized);
      setResult({ updated: body.updated ?? 0 });
      toast.success(
        body.updated > 0
          ? `Actualizado en ${body.updated} alumno${body.updated === 1 ? '' : 's'}`
          : 'Guardado (nadie tiene este modulo asignado todavia)'
      );
    } catch (err) {
      logger.error('admin.lesson.video.save.failed', { err, moduleId, lessonId: lesson.id });
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg bg-white/[0.02] border border-jjl-border/60 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{lesson.titulo}</p>
          {result && (
            <p className="text-[11px] text-green-400 mt-0.5">
              Aplicado a {result.updated} alumno{result.updated === 1 ? '' : 's'}
            </p>
          )}
        </div>
        {lastSaved && /^[a-zA-Z0-9_-]{11}$/.test(lastSaved) && (
          <a
            href={`https://www.youtube.com/watch?v=${lastSaved}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-jjl-muted hover:text-white shrink-0"
          >
            ver actual
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://youtu.be/XXXXXXXXXXX o solo el ID"
          className={`flex-1 min-w-0 h-9 px-3 bg-black/30 border rounded-md text-[12px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:ring-2 focus:ring-jjl-red/25 font-mono ${
            value && !isValid ? 'border-red-500/50 focus:border-red-500' : 'border-jjl-border focus:border-jjl-red'
          }`}
        />
        <Button
          size="sm"
          variant={changed ? 'primary' : 'secondary'}
          onClick={save}
          disabled={!changed || !isValid}
          loading={saving}
        >
          <Save className="h-3.5 w-3.5" />
          {changed ? 'Guardar' : 'Guardado'}
        </Button>
      </div>
      {value && !isValid && (
        <p className="text-[11px] text-red-400 mt-1.5">
          ID invalido. Pega la URL completa de YouTube o los 11 caracteres del ID.
        </p>
      )}
    </div>
  );
}

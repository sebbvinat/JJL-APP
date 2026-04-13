'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Play, Check, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getModuleFromMock, type ModuleData, type LessonData } from '@/lib/course-data';

export default function EditModulePage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  const [module, setModule] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    async function load() {
      // Try loading from Supabase first
      try {
        const res = await fetch(`/api/course-data?moduleId=${moduleId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.module) {
            setModule(data.module);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }

      // Fall back to mock data
      const mockData = getModuleFromMock(moduleId);
      setModule(mockData);
      setLoading(false);
    }
    load();
  }, [moduleId]);

  function updateModuleTitle(val: string) {
    if (!module) return;
    setModule({ ...module, titulo: val });
    setHasChanges(true);
  }

  function updateModuleDesc(val: string) {
    if (!module) return;
    setModule({ ...module, descripcion: val });
    setHasChanges(true);
  }

  function updateLesson(index: number, field: keyof LessonData, val: string) {
    if (!module) return;
    const lessons = [...module.lessons];
    lessons[index] = { ...lessons[index], [field]: val };
    setModule({ ...module, lessons });
    setHasChanges(true);
  }

  function removeLesson(index: number) {
    if (!module) return;
    const lessons = module.lessons.filter((_, i) => i !== index);
    setModule({ ...module, lessons });
    setHasChanges(true);
  }

  function addLesson() {
    if (!module) return;
    const newId = `${moduleId}-new-${Date.now()}`;
    // Pre-fill youtube_id from the last video lesson that has one
    const lastVideoWithUrl = [...module.lessons]
      .reverse()
      .find((l) => l.tipo === 'video' && l.youtube_id && l.youtube_id.length > 0);
    const newLesson: LessonData = {
      id: newId,
      titulo: 'Nueva leccion',
      youtube_id: lastVideoWithUrl?.youtube_id || '',
      descripcion: '',
      orden: module.lessons.length + 1,
      duracion: '10:00',
      tipo: 'video',
    };
    // Insert before reflection if it exists
    const lessons = [...module.lessons];
    const reflIdx = lessons.findIndex((l) => l.tipo === 'reflection');
    if (reflIdx >= 0) {
      lessons.splice(reflIdx, 0, newLesson);
    } else {
      lessons.push(newLesson);
    }
    setModule({ ...module, lessons });
    setHasChanges(true);
  }

  function moveLesson(index: number, direction: -1 | 1) {
    if (!module) return;
    const lessons = [...module.lessons];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    [lessons[index], lessons[targetIndex]] = [lessons[targetIndex], lessons[index]];
    setModule({ ...module, lessons });
    setHasChanges(true);
  }

  function extractYoutubeId(input: string): string {
    // Accept full URLs or just IDs
    const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : input.trim();
  }

  async function handleSave() {
    if (!module) return;
    setSaving(true);

    try {
      const res = await fetch('/api/admin/save-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: module.id,
          semana_numero: module.semana_numero,
          titulo: module.titulo,
          descripcion: module.descripcion,
          lessons: module.lessons,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      showToast('Modulo guardado', 'success');
      setHasChanges(false);
    } catch (err: any) {
      showToast(err.message || 'Error al guardar', 'error');
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-jjl-muted">Modulo no encontrado</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  const videoLessons = module.lessons.filter((l) => l.tipo !== 'reflection');
  const videosWithUrl = videoLessons.filter((l) => l.youtube_id && l.youtube_id.length > 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-xs text-jjl-red font-semibold uppercase tracking-wider">
              {module.semana_numero === 0 ? 'Fundamentos' : `Semana ${module.semana_numero}`}
            </span>
            <h1 className="text-xl font-bold">Editar Modulo</h1>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado'}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-jjl-muted">{videoLessons.length} lecciones</span>
        <span className="text-jjl-muted">•</span>
        <span className={videosWithUrl.length === videoLessons.length ? 'text-green-400' : 'text-yellow-400'}>
          {videosWithUrl.length}/{videoLessons.length} con video
        </span>
      </div>

      {/* Module info */}
      <Card>
        <h2 className="text-sm font-semibold text-jjl-red uppercase tracking-wider mb-3">Informacion del Modulo</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-jjl-muted mb-1 block">Titulo</label>
            <input
              type="text"
              value={module.titulo}
              onChange={(e) => updateModuleTitle(e.target.value)}
              className="w-full px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-white text-sm focus:outline-none focus:border-jjl-red"
            />
          </div>
          <div>
            <label className="text-xs text-jjl-muted mb-1 block">Descripcion</label>
            <input
              type="text"
              value={module.descripcion}
              onChange={(e) => updateModuleDesc(e.target.value)}
              className="w-full px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-white text-sm focus:outline-none focus:border-jjl-red"
            />
          </div>
        </div>
      </Card>

      {/* Lessons */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-jjl-red uppercase tracking-wider">Lecciones</h2>
          <button
            onClick={addLesson}
            className="flex items-center gap-1 text-xs text-jjl-muted hover:text-white px-3 py-1.5 rounded-lg hover:bg-jjl-gray-light transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar Leccion
          </button>
        </div>

        <div className="space-y-3">
          {module.lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className={`rounded-lg border transition-colors ${
                lesson.tipo === 'reflection'
                  ? 'bg-yellow-500/5 border-yellow-500/20'
                  : lesson.youtube_id
                    ? 'bg-jjl-gray-light/30 border-jjl-border'
                    : 'bg-red-900/10 border-red-500/20'
              }`}
            >
              <div className="p-3 space-y-2">
                {/* Row 1: order + title + actions */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveLesson(idx, -1)}
                      disabled={idx === 0}
                      className="text-jjl-muted hover:text-white disabled:opacity-20 text-xs"
                    >▲</button>
                    <button
                      onClick={() => moveLesson(idx, 1)}
                      disabled={idx === module.lessons.length - 1}
                      className="text-jjl-muted hover:text-white disabled:opacity-20 text-xs"
                    >▼</button>
                  </div>
                  <span className="text-xs text-jjl-muted w-6 shrink-0 text-center">{idx + 1}</span>
                  {lesson.tipo === 'reflection' ? (
                    <span className="flex-1 text-sm text-yellow-400 font-medium">{lesson.titulo}</span>
                  ) : (
                    <input
                      type="text"
                      value={lesson.titulo}
                      onChange={(e) => updateLesson(idx, 'titulo', e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white focus:outline-none focus:bg-jjl-gray-light/50 rounded px-2 py-1"
                    />
                  )}
                  {lesson.tipo !== 'reflection' && (
                    <button
                      onClick={() => removeLesson(idx)}
                      className="text-jjl-muted hover:text-red-400 p-1.5 rounded hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Row 2: YouTube ID + preview */}
                {lesson.tipo === 'video' && (
                  <div className="flex items-center gap-2 ml-10">
                    <Play className="h-3.5 w-3.5 text-jjl-muted shrink-0" />
                    <input
                      type="text"
                      value={lesson.youtube_id}
                      onChange={(e) => updateLesson(idx, 'youtube_id', extractYoutubeId(e.target.value))}
                      placeholder="YouTube ID o URL completa"
                      className="flex-1 bg-jjl-gray-light border border-jjl-border rounded px-2.5 py-1.5 text-xs text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
                    />
                    {lesson.youtube_id && (
                      <a
                        href={`https://youtube.com/watch?v=${lesson.youtube_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-jjl-muted hover:text-jjl-red p-1 shrink-0"
                        title="Ver en YouTube"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {lesson.youtube_id ? (
                      <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    ) : (
                      <span className="text-xs text-red-400 shrink-0">Sin video</span>
                    )}
                  </div>
                )}

                {/* Row 3: Description (collapsible) */}
                {lesson.tipo === 'video' && (
                  <div className="ml-10">
                    <textarea
                      value={lesson.descripcion}
                      onChange={(e) => updateLesson(idx, 'descripcion', e.target.value)}
                      placeholder="Descripcion (opcional)"
                      rows={1}
                      className="w-full bg-transparent border-0 border-b border-jjl-border/30 text-xs text-jjl-muted placeholder:text-jjl-muted/30 focus:outline-none focus:border-jjl-red resize-none px-2 py-1"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl ${
          toast.type === 'success'
            ? 'bg-green-900/90 border border-green-500/30 text-green-300'
            : 'bg-red-900/90 border border-red-500/30 text-red-300'
        }`}>
          {toast.type === 'success' && <Check className="h-4 w-4 inline mr-1.5" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

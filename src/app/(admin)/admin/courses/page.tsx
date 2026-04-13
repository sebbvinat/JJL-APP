'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, Trash2, Eye, Save, Copy, RefreshCw, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import { createClient } from '@/lib/supabase/client';
import { MOCK_MODULES, MOCK_LESSONS, type MockLesson } from '@/lib/mock-data';

interface GeneratedLesson {
  titulo: string;
  tipo: 'video' | 'reflection';
  descripcion: string;
  youtube_id: string;
}

interface GeneratedWeek {
  semana: number;
  titulo: string;
  descripcion: string;
  lessons: GeneratedLesson[];
}

const DRILL_DESC = '1x5\' drillear de cada lado. (en cada entrenamiento)\n\nSi ya estas avanzado con el drill, podes pedirle resistencia al compañero de forma escalonada de 0% a max 50%';
const ESPECIFICO_DESC = '1x5\' (en cada entrenamiento)';
const JUEGO_ECO_DESC = '1x5\' (en cada entrenamiento)';

type TabType = 'nuevo' | 'duplicar' | 'bloques';

export default function CoursesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('nuevo');

  // Wizard state
  const [step, setStep] = useState(1);
  const [posicionPrincipal, setPosicionPrincipal] = useState('');
  const [posicionSecundaria, setPosicionSecundaria] = useState('');
  const [cantidadSemanas, setCantidadSemanas] = useState(4);
  const [tieneConcepto, setTieneConcepto] = useState(true);
  const [tieneDrill, setTieneDrill] = useState(true);
  const [tieneEspecifico, setTieneEspecifico] = useState(true);
  const [tieneJuegoEco, setTieneJuegoEco] = useState(false);

  // Generated preview
  const [generatedWeeks, setGeneratedWeeks] = useState<GeneratedWeek[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function generateCourse() {
    const weeks: GeneratedWeek[] = [];
    for (let i = 0; i < cantidadSemanas; i++) {
      const weekNum = i + 1;
      const isFirstWeek = i === 0;
      const isLastWeek = i === cantidadSemanas - 1;
      const lessons: GeneratedLesson[] = [];

      if (isFirstWeek && tieneConcepto) {
        lessons.push({ titulo: `${posicionPrincipal}: Conceptos`, tipo: 'video', descripcion: '', youtube_id: '' });
        if (posicionSecundaria) {
          lessons.push({ titulo: `${posicionSecundaria}: Conceptos`, tipo: 'video', descripcion: '', youtube_id: '' });
        }
      }

      const varLabel = cantidadSemanas > 1 ? ` V${weekNum}` : '';
      lessons.push({ titulo: `${posicionPrincipal}${isFirstWeek && tieneConcepto ? '' : varLabel}`, tipo: 'video', descripcion: '', youtube_id: '' });

      if (tieneDrill) {
        lessons.push({ titulo: `Drill ${weekNum}: ${posicionPrincipal}`, tipo: 'video', descripcion: DRILL_DESC, youtube_id: '' });
      }

      if (posicionSecundaria) {
        lessons.push({ titulo: `${posicionSecundaria}${isFirstWeek && tieneConcepto ? '' : ` V${weekNum}`}`, tipo: 'video', descripcion: '', youtube_id: '' });
        if (tieneDrill) {
          lessons.push({ titulo: `Drill ${weekNum}: ${posicionSecundaria}`, tipo: 'video', descripcion: DRILL_DESC, youtube_id: '' });
        }
      }

      if (tieneEspecifico && (isLastWeek || i === cantidadSemanas - 2)) {
        lessons.push({ titulo: `Especifico de ${posicionPrincipal}`, tipo: 'video', descripcion: ESPECIFICO_DESC, youtube_id: '' });
      }
      if (tieneJuegoEco && isLastWeek) {
        lessons.push({ titulo: `Juego ecologico: ${posicionPrincipal}`, tipo: 'video', descripcion: JUEGO_ECO_DESC, youtube_id: '' });
      }

      lessons.push({ titulo: 'Reflexion semanal', tipo: 'reflection', descripcion: 'Responde las preguntas de reflexion de la semana', youtube_id: '' });

      let weekTitle = posicionPrincipal;
      if (posicionSecundaria) weekTitle += ` + ${posicionSecundaria}`;
      if (cantidadSemanas > 1 && !isFirstWeek) weekTitle += ` V${weekNum}`;

      weeks.push({
        semana: weekNum,
        titulo: weekTitle,
        descripcion: `Mes ${Math.ceil(weekNum / 4)} — ${posicionPrincipal}${posicionSecundaria ? ` y ${posicionSecundaria}` : ''}`,
        lessons,
      });
    }
    setGeneratedWeeks(weeks);
    setStep(3);
  }

  // --- Duplicate helpers ---

  function duplicateFromExisting(moduleIds: string[], replaceFrom: string, replaceTo: string) {
    const weeks: GeneratedWeek[] = [];
    moduleIds.forEach((modId, idx) => {
      const mod = MOCK_MODULES.find((m) => m.id === modId);
      const lessons = MOCK_LESSONS[modId] || [];
      if (!mod) return;

      const genLessons: GeneratedLesson[] = lessons.map((l) => ({
        titulo: replaceText(l.titulo, replaceFrom, replaceTo),
        tipo: l.tipo,
        descripcion: l.descripcion,
        youtube_id: '', // Links vacíos para el nuevo curso
      }));

      weeks.push({
        semana: idx + 1,
        titulo: replaceText(mod.titulo, replaceFrom, replaceTo),
        descripcion: replaceText(mod.descripcion || '', replaceFrom, replaceTo),
        lessons: genLessons,
      });
    });
    setGeneratedWeeks(weeks);
    setActiveTab('nuevo');
    setStep(3);
    setSaved(false);
  }

  function duplicateSingleWeek(modId: string, replaceFrom: string, replaceTo: string) {
    duplicateFromExisting([modId], replaceFrom, replaceTo);
  }

  function updateLessonTitle(weekIdx: number, lessonIdx: number, val: string) {
    setGeneratedWeeks((prev) => {
      const next = [...prev];
      next[weekIdx] = { ...next[weekIdx], lessons: [...next[weekIdx].lessons] };
      next[weekIdx].lessons[lessonIdx] = { ...next[weekIdx].lessons[lessonIdx], titulo: val };
      return next;
    });
  }

  function updateLessonYoutubeId(weekIdx: number, lessonIdx: number, val: string) {
    setGeneratedWeeks((prev) => {
      const next = [...prev];
      next[weekIdx] = { ...next[weekIdx], lessons: [...next[weekIdx].lessons] };
      next[weekIdx].lessons[lessonIdx] = { ...next[weekIdx].lessons[lessonIdx], youtube_id: val };
      return next;
    });
  }

  function removeLesson(weekIdx: number, lessonIdx: number) {
    setGeneratedWeeks((prev) => {
      const next = [...prev];
      next[weekIdx] = { ...next[weekIdx], lessons: next[weekIdx].lessons.filter((_, i) => i !== lessonIdx) };
      return next;
    });
  }

  function addLesson(weekIdx: number) {
    setGeneratedWeeks((prev) => {
      const next = [...prev];
      const reflIdx = next[weekIdx].lessons.findIndex((l) => l.tipo === 'reflection');
      const newL: GeneratedLesson = { titulo: 'Nueva leccion', tipo: 'video', descripcion: '', youtube_id: '' };
      const lessons = [...next[weekIdx].lessons];
      if (reflIdx >= 0) lessons.splice(reflIdx, 0, newL);
      else lessons.push(newL);
      next[weekIdx] = { ...next[weekIdx], lessons };
      return next;
    });
  }

  async function saveCourse() {
    setSaving(true);
    const supabase = createClient();

    for (const week of generatedWeeks) {
      const { data: existing } = await supabase
        .from('modules').select('semana_numero').order('semana_numero', { ascending: false }).limit(1);

      const existingTyped = existing as { semana_numero: number }[] | null;
      const nextSemana = existingTyped && existingTyped.length > 0 ? existingTyped[0].semana_numero + 1 : 1;

      const { data: mod } = await supabase
        .from('modules')
        .insert({ semana_numero: nextSemana, titulo: week.titulo, descripcion: week.descripcion } as any)
        .select().single();

      if (!mod) continue;
      const modTyped = mod as { id: string };

      const lessonRows = week.lessons.map((l, i) => ({
        module_id: modTyped.id, titulo: l.titulo, youtube_id: l.youtube_id || 'pending',
        descripcion: l.descripcion || null, orden: i + 1, duracion: l.tipo === 'reflection' ? null : '10:00',
      }));

      await supabase.from('lessons').insert(lessonRows as any);
    }
    setSaving(false);
    setSaved(true);
  }

  function resetWizard() {
    setSaved(false); setStep(1);
    setPosicionPrincipal(''); setPosicionSecundaria('');
    setGeneratedWeeks([]);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin')} className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Gestionar Cursos</h1>
          <p className="text-jjl-muted text-sm">Crea, duplica y asigna semanas a tus alumnos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-jjl-gray rounded-lg p-1">
        {([
          { key: 'nuevo' as TabType, label: 'Crear Nuevo', icon: Plus },
          { key: 'duplicar' as TabType, label: 'Duplicar Existente', icon: Copy },
          { key: 'bloques' as TabType, label: 'Asignar Bloques', icon: RefreshCw },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); if (key === 'nuevo') resetWizard(); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-jjl-red text-white' : 'text-jjl-muted hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ======= TAB: CREAR NUEVO ======= */}
      {activeTab === 'nuevo' && (
        <>
          {/* Step indicator */}
          {!saved && (
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step >= s ? 'bg-jjl-red text-white' : 'bg-jjl-gray-light text-jjl-muted'
                  }`}>{s}</div>
                  <span className={`text-sm hidden sm:inline ${step >= s ? 'text-white' : 'text-jjl-muted'}`}>
                    {s === 1 ? 'Posicion' : s === 2 ? 'Opciones' : 'Preview'}
                  </span>
                  {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-jjl-red' : 'bg-jjl-gray-light'}`} />}
                </div>
              ))}
            </div>
          )}

          {step === 1 && !saved && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">¿Que posicion enseñaras?</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-jjl-muted mb-1 block">Posicion principal *</label>
                  <input type="text" placeholder="Ej: Guardia Cerrada, Montada, De la Riva..."
                    value={posicionPrincipal} onChange={(e) => setPosicionPrincipal(e.target.value)}
                    className="w-full px-4 py-3 bg-jjl-gray-light border border-jjl-border rounded-lg text-white placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red text-lg" />
                </div>
                <div>
                  <label className="text-sm text-jjl-muted mb-1 block">Posicion secundaria (opcional)</label>
                  <input type="text" placeholder="Ej: Toreos, Gola Manga..."
                    value={posicionSecundaria} onChange={(e) => setPosicionSecundaria(e.target.value)}
                    className="w-full px-4 py-3 bg-jjl-gray-light border border-jjl-border rounded-lg text-white placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red" />
                </div>
                <div>
                  <label className="text-sm text-jjl-muted mb-1 block">¿Cuantas semanas?</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button key={n} onClick={() => setCantidadSemanas(n)}
                        className={`w-12 h-12 rounded-lg text-lg font-bold transition-colors ${
                          cantidadSemanas === n ? 'bg-jjl-red text-white' : 'bg-jjl-gray-light text-jjl-muted hover:text-white border border-jjl-border'
                        }`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="primary" onClick={() => setStep(2)} disabled={!posicionPrincipal.trim()}>
                    Siguiente <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {step === 2 && !saved && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Opciones del curso</h2>
              <div className="space-y-4">
                {[
                  { label: '¿Tiene video de concepto?', desc: 'Video introductorio (semana 1)', val: tieneConcepto, set: setTieneConcepto },
                  { label: '¿Incluir drills?', desc: '1 drill por variante por semana', val: tieneDrill, set: setTieneDrill },
                  { label: '¿Incluir especifico?', desc: 'Ejercicio especifico de la posicion', val: tieneEspecifico, set: setTieneEspecifico },
                  { label: '¿Incluir juego ecologico?', desc: 'Juego ecologico (ultima semana)', val: tieneJuegoEco, set: setTieneJuegoEco },
                ].map((opt, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-jjl-border last:border-0">
                    <div><p className="font-medium">{opt.label}</p><p className="text-xs text-jjl-muted">{opt.desc}</p></div>
                    <Toggle checked={opt.val} onChange={opt.set} />
                  </div>
                ))}
                <div className="flex justify-between pt-4">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Atras
                  </Button>
                  <Button variant="primary" onClick={generateCourse}>
                    <Eye className="h-4 w-4 mr-1.5" /> Generar Preview
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {step === 3 && !saved && <WeekPreview weeks={generatedWeeks} onBack={() => setStep(2)}
            onSave={saveCourse} saving={saving}
            onUpdateTitle={updateLessonTitle} onUpdateYtId={updateLessonYoutubeId}
            onRemove={removeLesson} onAdd={addLesson} />}

          {saved && (
            <Card>
              <div className="text-center py-8 space-y-4">
                <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Save className="h-8 w-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold">Curso guardado</h2>
                <p className="text-jjl-muted">{generatedWeeks.length} semanas creadas. Asignalas a tus alumnos desde el panel.</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="primary" onClick={() => router.push('/admin')}>Ir al Panel</Button>
                  <Button variant="secondary" onClick={resetWizard}>Crear Otro</Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ======= TAB: DUPLICAR ======= */}
      {activeTab === 'duplicar' && (
        <DuplicateTab
          onDuplicateCourse={duplicateFromExisting}
          onDuplicateWeek={duplicateSingleWeek}
        />
      )}

      {/* ======= TAB: BLOQUES ======= */}
      {activeTab === 'bloques' && <BlockAssignTab />}
    </div>
  );
}

// ---- Replace text helper ----
function replaceText(text: string, from: string, to: string): string {
  if (!from) return text;
  const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(regex, to);
}

// ---- Week Preview (shared) ----
function WeekPreview({ weeks, onBack, onSave, saving, onUpdateTitle, onUpdateYtId, onRemove, onAdd }: {
  weeks: GeneratedWeek[];
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  onUpdateTitle: (wi: number, li: number, v: string) => void;
  onUpdateYtId: (wi: number, li: number, v: string) => void;
  onRemove: (wi: number, li: number) => void;
  onAdd: (wi: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Modificar
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Guardando...' : 'Guardar en Supabase'}
        </Button>
      </div>
      {weeks.map((week, wi) => (
        <Card key={wi}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              <span className="text-jjl-red text-xs uppercase tracking-wider">Semana {week.semana}</span><br />{week.titulo}
            </h3>
            <button onClick={() => onAdd(wi)} className="text-xs text-jjl-muted hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-jjl-gray-light">
              <Plus className="h-3 w-3" /> Leccion
            </button>
          </div>
          <div className="space-y-2">
            {week.lessons.map((lesson, li) => (
              <div key={li} className={`flex items-center gap-2 p-2 rounded-lg ${
                lesson.tipo === 'reflection' ? 'bg-yellow-500/5 border border-yellow-500/10' : 'bg-jjl-gray-light/50'
              }`}>
                <span className="text-xs text-jjl-muted w-6 shrink-0">{li + 1}.</span>
                <input type="text" value={lesson.titulo} onChange={(e) => onUpdateTitle(wi, li, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none" disabled={lesson.tipo === 'reflection'} />
                {lesson.tipo === 'video' && (
                  <input type="text" value={lesson.youtube_id} onChange={(e) => onUpdateYtId(wi, li, e.target.value)}
                    placeholder="YouTube ID" className="w-28 bg-jjl-gray-light border border-jjl-border rounded px-2 py-1 text-xs text-jjl-muted focus:outline-none focus:border-jjl-red focus:text-white" />
                )}
                {lesson.tipo !== 'reflection' && (
                  <button onClick={() => onRemove(wi, li)} className="text-jjl-muted hover:text-red-400 p-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

// ---- Duplicate Tab ----
function DuplicateTab({ onDuplicateCourse, onDuplicateWeek }: {
  onDuplicateCourse: (ids: string[], from: string, to: string) => void;
  onDuplicateWeek: (id: string, from: string, to: string) => void;
}) {
  const [replaceFrom, setReplaceFrom] = useState('');
  const [replaceTo, setReplaceTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const monthGroups = [
    { key: 'fund', label: 'Fundamentos', mods: MOCK_MODULES.filter((m) => m.semana_numero === 0) },
    { key: 'm1', label: 'Mes 1 — Guardia Cerrada + Toreos', mods: MOCK_MODULES.filter((m) => m.semana_numero >= 1 && m.semana_numero <= 4) },
    { key: 'm2', label: 'Mes 2 — 100 KG + Kimura/Armbar/Escape', mods: MOCK_MODULES.filter((m) => m.semana_numero >= 5 && m.semana_numero <= 8) },
    { key: 'm3', label: 'Mes 3 — Leg Trap + De la Riva', mods: MOCK_MODULES.filter((m) => m.semana_numero >= 9 && m.semana_numero <= 12) },
    { key: 'm4', label: 'Mes 4 — Montada + Escapes', mods: MOCK_MODULES.filter((m) => m.semana_numero >= 13 && m.semana_numero <= 16) },
    { key: 'm5', label: 'Mes 5 — Cross Grip + Gola Manga', mods: MOCK_MODULES.filter((m) => m.semana_numero >= 17 && m.semana_numero <= 20) },
    { key: 'm6', label: 'Mes 6 — Defensa/Ataques Espalda', mods: MOCK_MODULES.filter((m) => m.semana_numero >= 21 && m.semana_numero <= 24) },
  ];

  const selectedMonthData = monthGroups.find((g) => g.key === selectedMonth);

  return (
    <div className="space-y-4">
      {/* Search & Replace */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">
          <Search className="h-4 w-4 inline mr-2" />
          Reemplazar Tecnica
        </h2>
        <p className="text-xs text-jjl-muted mb-3">
          Al duplicar, todos los nombres de la tecnica vieja se cambian por la nueva automaticamente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-jjl-muted mb-1 block">Tecnica original</label>
            <input type="text" placeholder="Ej: Guardia Cerrada" value={replaceFrom}
              onChange={(e) => setReplaceFrom(e.target.value)}
              className="w-full px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-white text-sm placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red" />
          </div>
          <div>
            <label className="text-xs text-jjl-muted mb-1 block">Nueva tecnica</label>
            <input type="text" placeholder="Ej: Media Guardia" value={replaceTo}
              onChange={(e) => setReplaceTo(e.target.value)}
              className="w-full px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-white text-sm placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red" />
          </div>
        </div>
      </Card>

      {/* Course blocks to duplicate */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">Selecciona que duplicar</h2>
        <div className="space-y-2">
          {monthGroups.map((group) => (
            <div key={group.key}>
              <button
                onClick={() => setSelectedMonth(selectedMonth === group.key ? null : group.key)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedMonth === group.key
                    ? 'bg-jjl-red/20 text-jjl-red border border-jjl-red/30'
                    : 'bg-jjl-gray-light border border-jjl-border text-jjl-muted hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{group.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-70">{group.mods.length} semanas</span>
                    {selectedMonth !== group.key && (
                      <Copy className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded: show individual weeks */}
              {selectedMonth === group.key && (
                <div className="ml-4 mt-2 space-y-1">
                  {/* Duplicate entire month */}
                  <button
                    onClick={() => onDuplicateCourse(group.mods.map((m) => m.id), replaceFrom, replaceTo)}
                    className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium bg-jjl-red/10 text-jjl-red border border-jjl-red/20 hover:bg-jjl-red/20 transition-colors mb-2"
                  >
                    <Copy className="h-3.5 w-3.5 inline mr-2" />
                    Duplicar todo &quot;{group.label}&quot;
                    {replaceTo && <span className="opacity-70"> → {replaceTo}</span>}
                  </button>

                  {/* Individual weeks */}
                  {group.mods.map((mod) => {
                    const lessons = MOCK_LESSONS[mod.id] || [];
                    const videoCount = lessons.filter((l) => l.tipo !== 'reflection').length;
                    return (
                      <div key={mod.id}
                        className="flex items-center justify-between px-4 py-2 rounded-lg bg-jjl-gray-light/30 hover:bg-jjl-gray-light transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-xs text-jjl-red font-bold mr-2">
                            {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                          </span>
                          <span className="text-sm text-white">{mod.titulo}</span>
                          <span className="text-xs text-jjl-muted ml-2">({videoCount} videos)</span>
                        </div>
                        <button
                          onClick={() => onDuplicateWeek(mod.id, replaceFrom, replaceTo)}
                          className="text-xs text-jjl-muted hover:text-jjl-red flex items-center gap-1 px-2 py-1 rounded hover:bg-jjl-gray shrink-0"
                        >
                          <Copy className="h-3 w-3" /> Duplicar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---- Block Assignment Tab ----
function BlockAssignTab() {
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [targetStudentId, setTargetStudentId] = useState('');
  const [students, setStudents] = useState<{ id: string; nombre: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('users').select('id, nombre').eq('rol', 'alumno');
      if (data) setStudents(data as any);
    })();
  }, []);

  const months = [
    { label: 'Fundamentos', ids: MOCK_MODULES.filter((m) => m.semana_numero === 0).map((m) => m.id) },
    { label: 'Mes 1 (S1-S4)', ids: MOCK_MODULES.filter((m) => m.semana_numero >= 1 && m.semana_numero <= 4).map((m) => m.id) },
    { label: 'Mes 2 (S5-S8)', ids: MOCK_MODULES.filter((m) => m.semana_numero >= 5 && m.semana_numero <= 8).map((m) => m.id) },
    { label: 'Mes 3 (S9-S12)', ids: MOCK_MODULES.filter((m) => m.semana_numero >= 9 && m.semana_numero <= 12).map((m) => m.id) },
    { label: 'Mes 4 (S13-S16)', ids: MOCK_MODULES.filter((m) => m.semana_numero >= 13 && m.semana_numero <= 16).map((m) => m.id) },
    { label: 'Mes 5 (S17-S20)', ids: MOCK_MODULES.filter((m) => m.semana_numero >= 17 && m.semana_numero <= 20).map((m) => m.id) },
    { label: 'Mes 6 (S21-S24)', ids: MOCK_MODULES.filter((m) => m.semana_numero >= 21 && m.semana_numero <= 24).map((m) => m.id) },
  ];

  function selectMonth(ids: string[]) {
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function assignBlocks() {
    if (!targetStudentId || selectedBlocks.size === 0) return;
    setAssigning(true);
    const supabase = createClient();
    const rows = Array.from(selectedBlocks).map((modId) => ({
      user_id: targetStudentId, module_id: modId, is_unlocked: true,
    }));
    await supabase.from('user_access').upsert(rows as any, { onConflict: 'user_id,module_id' });
    setAssigning(false);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4">Asignar Bloques a Alumno</h2>
      <div className="mb-4">
        <label className="text-sm text-jjl-muted mb-1 block">Alumno</label>
        <select value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)}
          className="w-full px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-white text-sm focus:outline-none focus:border-jjl-red">
          <option value="">Seleccionar alumno...</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <div className="space-y-2 mb-4">
        {months.map((month) => {
          const allSelected = month.ids.every((id) => selectedBlocks.has(id));
          const someSelected = month.ids.some((id) => selectedBlocks.has(id));
          return (
            <button key={month.label} onClick={() => selectMonth(month.ids)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                allSelected ? 'bg-jjl-red/20 text-jjl-red border border-jjl-red/30'
                : someSelected ? 'bg-jjl-gray-light border border-jjl-red/10 text-white'
                : 'bg-jjl-gray-light border border-jjl-border text-jjl-muted hover:text-white'
              }`}>
              {month.label} <span className="text-xs ml-2 opacity-70">({month.ids.length} semanas)</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-jjl-muted mb-3">{selectedBlocks.size} modulos seleccionados</p>
      <Button variant="primary" size="sm" onClick={assignBlocks}
        disabled={!targetStudentId || selectedBlocks.size === 0 || assigning} className="w-full">
        {done ? 'Asignado!' : assigning ? 'Asignando...' : `Asignar ${selectedBlocks.size} modulos`}
      </Button>
    </Card>
  );
}

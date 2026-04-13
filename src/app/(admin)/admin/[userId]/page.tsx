'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Play, Pencil,
  Upload, Copy, FileSpreadsheet,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import { MOCK_MODULES, MOCK_LESSONS } from '@/lib/mock-data';
import { PLANILLAS } from '@/lib/planillas';
import type { User } from '@/lib/supabase/types';
import type { LessonData } from '@/lib/course-data';

interface ModuleInfo {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string;
  lessons: LessonData[];
}

export default function AdminStudentPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [student, setStudent] = useState<User | null>(null);
  const [unlockedModules, setUnlockedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Student's course modules (from course_data or fallback to mock)
  const [studentModules, setStudentModules] = useState<ModuleInfo[]>([]);
  const [hasCourseData, setHasCourseData] = useState(false);

  // Planilla/copy UI
  const [showPlanillaMenu, setShowPlanillaMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; nombre: string }[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Fetch student info + access + course data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/admin/student-data?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setStudent(data.student);
        setUnlockedModules(new Set(data.unlockedModuleIds || []));
      } catch (err) {
        console.error('Fetch student error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    loadStudentCourse();
  }, [userId]);

  async function loadStudentCourse() {
    // Fetch this student's course_data
    try {
      const res = await fetch(`/api/admin/student-course?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.modules && data.modules.length > 0) {
          setStudentModules(data.modules);
          setHasCourseData(true);
          return;
        }
      }
    } catch { /* fall through */ }

    // Fallback to mock data
    setStudentModules(
      MOCK_MODULES.map((mod) => ({
        id: mod.id,
        semana_numero: mod.semana_numero,
        titulo: mod.titulo,
        descripcion: mod.descripcion,
        lessons: (MOCK_LESSONS[mod.id] || []).map((l) => ({
          id: l.id,
          titulo: l.titulo,
          youtube_id: l.youtube_id,
          descripcion: l.descripcion,
          orden: l.orden,
          duracion: l.duracion,
          tipo: l.tipo as 'video' | 'reflection',
        })),
      }))
    );
    setHasCourseData(false);
  }

  async function saveAccess(modules: { id: string; is_unlocked: boolean }[]) {
    const res = await fetch('/api/admin/toggle-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, modules }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al guardar');
    }
  }

  async function toggleModule(moduleId: string) {
    setSaving(moduleId);
    const isCurrentlyUnlocked = unlockedModules.has(moduleId);
    const newValue = !isCurrentlyUnlocked;
    const previousSet = new Set(unlockedModules);

    setUnlockedModules((prev) => {
      const next = new Set(prev);
      if (newValue) next.add(moduleId);
      else next.delete(moduleId);
      return next;
    });

    try {
      await saveAccess([{ id: moduleId, is_unlocked: newValue }]);
      showToast('Guardado', 'success');
    } catch (err: any) {
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error al guardar', 'error');
    }

    setSaving(null);
  }

  async function unlockUpTo(targetModuleIndex: number) {
    setSaving('batch');
    const modulesToUnlock = studentModules.slice(0, targetModuleIndex + 1);
    const previousSet = new Set(unlockedModules);

    const newSet = new Set(unlockedModules);
    modulesToUnlock.forEach((m) => newSet.add(m.id));
    setUnlockedModules(newSet);

    try {
      await saveAccess(modulesToUnlock.map((m) => ({ id: m.id, is_unlocked: true })));
      showToast(`${modulesToUnlock.length} modulos desbloqueados`, 'success');
    } catch (err: any) {
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error al desbloquear', 'error');
    }

    setSaving(null);
  }

  async function lockAll() {
    setSaving('batch');
    const previousSet = new Set(unlockedModules);
    setUnlockedModules(new Set());

    try {
      await saveAccess(studentModules.map((m) => ({ id: m.id, is_unlocked: false })));
      showToast('Todos los modulos bloqueados', 'success');
    } catch (err: any) {
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error al bloquear', 'error');
    }

    setSaving(null);
  }

  async function handleLoadPlanilla(planillaId: string) {
    if (!confirm(`Cargar planilla "${PLANILLAS.find(p => p.id === planillaId)?.nombre}"? Esto reemplaza el curso actual de este alumno.`)) return;

    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/load-planilla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planillaId, userId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Planilla cargada (${data.saved} modulos)`, 'success');
        await loadStudentCourse();
      } else if (data.errors) {
        showToast(`${data.saved} cargados, ${data.errors.length} errores`, 'error');
        console.error('Planilla errors:', data.errors);
      } else {
        showToast(data.error || 'Error al cargar', 'error');
      }
    } catch {
      showToast('Error de conexion', 'error');
    }
    setLoadingAction(false);
    setShowPlanillaMenu(false);
  }

  async function handleCopyFromStudent(fromUserId: string) {
    const fromStudent = allStudents.find(s => s.id === fromUserId);
    if (!confirm(`Copiar curso de "${fromStudent?.nombre}"? Esto reemplaza el curso actual de este alumno.`)) return;

    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/copy-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId, toUserId: userId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Curso copiado (${data.saved} modulos)`, 'success');
        await loadStudentCourse();
      } else {
        showToast(data.error || 'Error al copiar', 'error');
      }
    } catch {
      showToast('Error de conexion', 'error');
    }
    setLoadingAction(false);
    setShowCopyMenu(false);
  }

  async function openCopyMenu() {
    setShowCopyMenu(true);
    if (allStudents.length === 0) {
      try {
        const res = await fetch('/api/admin/students');
        if (res.ok) {
          const data = await res.json();
          setAllStudents(
            (data.students || [])
              .filter((s: any) => s.id !== userId)
              .map((s: any) => ({ id: s.id, nombre: s.nombre }))
          );
        }
      } catch {}
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-jjl-muted">Alumno no encontrado</p>
      </div>
    );
  }

  // Group modules by month
  const monthGroups = [
    { label: 'Fundamentos', range: [0, 0] },
    { label: 'Mes 1 (S1-S4)', range: [1, 4] },
    { label: 'Mes 2 (S5-S8)', range: [5, 8] },
    { label: 'Mes 3 (S9-S12)', range: [9, 12] },
    { label: 'Mes 4 (S13-S16)', range: [13, 16] },
    { label: 'Mes 5 (S17-S20)', range: [17, 20] },
    { label: 'Mes 6 (S21-S24)', range: [21, 24] },
  ].map(({ label, range }) => ({
    label,
    modules: studentModules.filter((m) => m.semana_numero >= range[0] && m.semana_numero <= range[1]),
  })).filter(g => g.modules.length > 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/admin')}
        className="flex items-center gap-2 text-jjl-muted hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Alumnos
      </button>

      {/* Student Info */}
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={student.nombre} size="lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{student.nombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge belt={student.cinturon_actual} />
              <span className="text-sm text-jjl-muted">{student.email}</span>
            </div>
            <p className="text-xs text-jjl-muted mt-1">
              Miembro desde {new Date(student.created_at).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-bold text-jjl-red">{unlockedModules.size}</p>
            <p className="text-xs text-jjl-muted">Modulos activos</p>
          </div>
        </div>
      </Card>

      {/* Course setup: Load planilla or copy */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Curso del Alumno</h2>
            <p className="text-xs text-jjl-muted mt-0.5">
              {hasCourseData
                ? `${studentModules.length} semanas cargadas`
                : 'Usando curso por defecto (mock). Carga una planilla o copia de otro alumno.'
              }
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setShowPlanillaMenu(!showPlanillaMenu); setShowCopyMenu(false); }}
            disabled={loadingAction}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Cargar Planilla
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { openCopyMenu(); setShowPlanillaMenu(false); }}
            disabled={loadingAction}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copiar de otro alumno
          </Button>
        </div>

        {/* Planilla selector */}
        {showPlanillaMenu && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLANILLAS.filter(p => p.id !== 'atleticos').map((planilla) => (
              <button
                key={planilla.id}
                onClick={() => handleLoadPlanilla(planilla.id)}
                disabled={loadingAction}
                className="flex items-center gap-3 p-3 rounded-lg border border-jjl-border hover:border-jjl-red bg-jjl-gray-light/50 hover:bg-jjl-gray-light transition-colors text-left"
              >
                <Upload className="h-4 w-4 text-jjl-red shrink-0" />
                <div>
                  <p className="text-sm font-medium">{planilla.nombre}</p>
                  <p className="text-xs text-jjl-muted">{planilla.descripcion}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Copy from student selector */}
        {showCopyMenu && (
          <div className="mt-4 space-y-1 max-h-60 overflow-y-auto">
            {allStudents.length === 0 ? (
              <p className="text-sm text-jjl-muted py-4 text-center">No hay otros alumnos</p>
            ) : (
              allStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleCopyFromStudent(s.id)}
                  disabled={loadingAction}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jjl-gray-light text-left transition-colors"
                >
                  <Avatar name={s.nombre} size="sm" />
                  <span className="text-sm">{s.nombre}</span>
                </button>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Quick unlock buttons */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold">Desbloqueo Rapido</h2>
          {saving && (
            <div className="w-4 h-4 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Fundamentos', index: 0 },
            { label: 'Mes 1', index: 4 },
            { label: 'Mes 2', index: 8 },
            { label: 'Mes 3', index: 12 },
            { label: 'Mes 4', index: 16 },
            { label: 'Mes 5', index: 20 },
            { label: 'Mes 6 (Todo)', index: 24 },
          ].map(({ label, index }) => {
            const targetModules = studentModules.slice(0, index + 1);
            const allUnlocked = targetModules.length > 0 && targetModules.every((m) => unlockedModules.has(m.id));
            return (
              <button
                key={index}
                onClick={() => unlockUpTo(index)}
                disabled={saving !== null}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  allUnlocked
                    ? 'bg-jjl-red/20 text-jjl-red border border-jjl-red/30'
                    : 'bg-jjl-gray-light border border-jjl-border text-jjl-muted hover:text-white'
                }`}
              >
                {allUnlocked && <Check className="h-3 w-3 inline mr-1" />}
                {label}
              </button>
            );
          })}
          <button
            onClick={lockAll}
            disabled={saving !== null}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-900/30 border border-red-800/30 text-red-400 hover:text-red-300 transition-colors"
          >
            Bloquear Todo
          </button>
        </div>
      </Card>

      {/* Module toggles grouped by month */}
      {monthGroups.map((group) => (
        <Card key={group.label}>
          <h2 className="text-sm font-semibold text-jjl-red uppercase tracking-wider mb-3">
            {group.label}
          </h2>
          <div className="space-y-1">
            {group.modules.map((mod) => {
              const isUnlocked = unlockedModules.has(mod.id);
              const isExpanded = expandedModule === mod.id;
              const lessons = mod.lessons || [];
              const videoLessons = lessons.filter((l) => l.tipo !== 'reflection');
              const videosWithUrl = videoLessons.filter((l) => l.youtube_id && l.youtube_id.length > 0);

              return (
                <div key={mod.id}>
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isUnlocked ? 'bg-jjl-gray-light/50' : ''
                    } ${isExpanded ? 'rounded-b-none' : ''}`}
                  >
                    <button
                      onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-jjl-muted shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-jjl-muted shrink-0" />
                      )}
                      <span className="text-xs font-bold text-jjl-red w-8 shrink-0">
                        {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                      </span>
                      <div className="min-w-0">
                        <span className={`text-sm truncate block ${isUnlocked ? 'text-white' : 'text-jjl-muted'}`}>
                          {mod.titulo}
                        </span>
                        <span className="text-xs text-jjl-muted">
                          {videoLessons.length} lecciones
                          {videosWithUrl.length < videoLessons.length && (
                            <span className="text-yellow-500 ml-1">
                              ({videosWithUrl.length}/{videoLessons.length} videos)
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/admin/edit/${mod.id}?userId=${userId}`}
                        className="p-1.5 rounded hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors"
                        title="Editar modulo"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <Toggle
                        checked={isUnlocked}
                        onChange={() => toggleModule(mod.id)}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Expanded lesson list */}
                  {isExpanded && (
                    <div className="bg-jjl-gray-light/20 rounded-b-lg border-t border-jjl-border/30 px-4 py-2 space-y-1">
                      {lessons.map((lesson, li) => (
                        <div
                          key={lesson.id || li}
                          className={`flex items-center gap-2 py-1.5 text-xs ${
                            lesson.tipo === 'reflection' ? 'text-yellow-400' : 'text-jjl-muted'
                          }`}
                        >
                          <span className="w-5 text-right shrink-0 opacity-50">{li + 1}.</span>
                          {lesson.tipo === 'video' ? (
                            <Play className="h-3 w-3 shrink-0" />
                          ) : (
                            <span className="w-3 shrink-0 text-center">📝</span>
                          )}
                          <span className="flex-1 truncate">{lesson.titulo}</span>
                          {lesson.tipo === 'video' && (
                            lesson.youtube_id ? (
                              <Check className="h-3 w-3 text-green-400 shrink-0" />
                            ) : (
                              <span className="text-red-400 shrink-0">sin video</span>
                            )
                          )}
                        </div>
                      ))}
                      <Link
                        href={`/admin/edit/${mod.id}?userId=${userId}`}
                        className="flex items-center gap-1.5 text-xs text-jjl-red hover:text-white py-2 transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Editar lecciones
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl transition-all ${
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

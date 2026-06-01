'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Play, Pencil,
  Upload, Copy, FileSpreadsheet, Flame, BookOpen, Trophy, Calendar,
  MessageSquare, TrendingUp, Dumbbell, StickyNote, Phone, History,
} from 'lucide-react';
import CrmHeader from '@/components/admin/profile/CrmHeader';
import NotesTab from '@/components/admin/profile/NotesTab';
import TimelineTab from '@/components/admin/profile/TimelineTab';
import LlamadasTab from '@/components/admin/profile/LlamadasTab';
import Schedule1on1Modal from '@/components/admin/profile/Schedule1on1Modal';
import ConfirmMonthDialog from '@/components/admin/profile/ConfirmMonthDialog';
import { format, subDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import { MOCK_MODULES, MOCK_LESSONS } from '@/lib/mock-data';
import { PLANILLAS } from '@/lib/planillas';
import { MONTH_RANGES } from '@/lib/crm';
import { calculateGamification } from '@/lib/gamification';
import { BELT_LABELS } from '@/lib/constants';
import type { User } from '@/lib/supabase/types';
import type { LessonData } from '@/lib/course-data';
import StudentVideos from '@/components/admin/StudentVideos';
import { Video as VideoIcon } from 'lucide-react';

interface ModuleInfo {
  id: string;
  semana_numero: number;
  titulo: string;
  descripcion: string;
  lessons: LessonData[];
}

interface Metrics {
  trainedDays: string[];
  totalTrainingDays: number;
  streak: number;
  feedbacks: { fecha: string; texto: string }[];
  completedLessonIds: string[];
  completedLessonsCount: number;
  unlockedModulesCount: number;
  cinturon: string;
  puntos: number;
}

type SectionType = 'metricas' | 'videos' | 'curso' | 'modulos' | 'notas' | 'timeline' | 'llamadas';

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
  const [activeSection, setActiveSection] = useState<SectionType>('metricas');

  // Student's course modules
  const [studentModules, setStudentModules] = useState<ModuleInfo[]>([]);
  const [hasCourseData, setHasCourseData] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // Planilla/copy UI
  const [showPlanillaMenu, setShowPlanillaMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; nombre: string }[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);

  // CRM modals + refresh key
  const [showSchedule, setShowSchedule] = useState(false);
  const [showConfirmMonth, setShowConfirmMonth] = useState(false);
  const [confirmMonthCtx, setConfirmMonthCtx] = useState<{
    currentMesLabel: string;
    nextMesLabel: string | null;
    nextModulesPreview: string[];
  } | null>(null);
  const [crmRefreshKey, setCrmRefreshKey] = useState(0);

  // Antes de abrir el dialog, traemos el preview de módulos a desbloquear.
  async function openConfirmMonth() {
    try {
      const res = await fetch(`/api/admin/students/${userId}/crm-summary`, { cache: 'no-store' });
      const data = await res.json();
      type M = { mes: number; label: string; moduleIds: string[] };
      const cm = data?.month?.currentMes as number | null;
      const nm = data?.month?.nextMes as number | null;
      const months = (data?.month?.months as M[] | undefined) || [];
      const currentMesLabel = cm !== null ? (months.find((m) => m.mes === cm)?.label || `Mes ${cm}`) : '—';
      const nextBlock = nm !== null ? months.find((m) => m.mes === nm) : null;
      setConfirmMonthCtx({
        currentMesLabel,
        nextMesLabel: nextBlock?.label || null,
        nextModulesPreview: nextBlock?.moduleIds || [],
      });
      setShowConfirmMonth(true);
    } catch { /* silencioso */ }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

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

    async function fetchMetrics() {
      try {
        const res = await fetch(`/api/admin/student-metrics?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch {}
    }

    fetchData();
    fetchMetrics();
    loadStudentCourse();
  }, [userId]);

  async function loadStudentCourse() {
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
    } catch {}

    setStudentModules(
      MOCK_MODULES.map((mod) => ({
        id: mod.id,
        semana_numero: mod.semana_numero,
        titulo: mod.titulo,
        descripcion: mod.descripcion,
        lessons: (MOCK_LESSONS[mod.id] || []).map((l) => ({
          id: l.id, titulo: l.titulo, youtube_id: l.youtube_id,
          descripcion: l.descripcion, orden: l.orden, duracion: l.duracion,
          tipo: l.tipo as 'video' | 'reflection',
        })),
      }))
    );
    setHasCourseData(false);
  }

  // Gamification calculated from metrics
  const gamification = useMemo(() => {
    if (!metrics || !studentModules.length) return null;
    const completedIds = new Set(metrics.completedLessonIds);

    const completedWeeks = studentModules
      .filter((mod) => {
        const videoLessons = mod.lessons.filter((l) => l.tipo !== 'reflection');
        return videoLessons.length > 0 && videoLessons.every((l) => completedIds.has(l.id));
      })
      .map((mod) => mod.semana_numero);

    return calculateGamification({
      completedWeeks,
      totalTrainingDays: metrics.totalTrainingDays,
      totalLessonsCompleted: metrics.completedLessonsCount,
    });
  }, [metrics, studentModules]);

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
    const newValue = !unlockedModules.has(moduleId);
    const previousSet = new Set(unlockedModules);

    setUnlockedModules((prev) => {
      const next = new Set(prev);
      if (newValue) next.add(moduleId); else next.delete(moduleId);
      return next;
    });

    try {
      await saveAccess([{ id: moduleId, is_unlocked: newValue }]);
      showToast('Guardado', 'success');
    } catch (err: any) {
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error', 'error');
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
      showToast(err.message || 'Error', 'error');
    }
    setSaving(null);
  }

  async function lockAll() {
    setSaving('batch');
    const previousSet = new Set(unlockedModules);
    setUnlockedModules(new Set());
    try {
      await saveAccess(studentModules.map((m) => ({ id: m.id, is_unlocked: false })));
      showToast('Todos bloqueados', 'success');
    } catch (err: any) {
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error', 'error');
    }
    setSaving(null);
  }

  async function quickUnlockMonth(mes: number, label: string, total: number) {
    if (total === 0) return;
    const uid = userId || student?.id;
    if (!uid) {
      showToast('No detecté el ID del alumno', 'error');
      return;
    }
    if (!confirm(`Desbloquear los ${total} módulo${total === 1 ? '' : 's'} de ${label}? Se notifica al alumno.`)) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [uid],
          action: 'unlock_month',
          payload: { mes },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      // Marcar todos los modulos del block como unlocked en UI local
      const block = MONTH_RANGES.find((b) => b.mes === mes);
      if (block) {
        const blockModuleIds = studentModules
          .filter((m) => block.semanas.includes(m.semana_numero))
          .map((m) => m.id);
        setUnlockedModules((prev) => {
          const next = new Set(prev);
          blockModuleIds.forEach((id) => next.add(id));
          return next;
        });
      }
      showToast(`${label} desbloqueado (${data.affected_modules || total} módulos)`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleLoadPlanilla(planillaId: string) {
    // Defensiva: capturamos el id del alumno desde varias fuentes por si
    // useParams() devuelve algo raro (Next 16 a veces se porta distinto).
    const uid = userId || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '') || student?.id || '';
    if (!uid) {
      showToast('No detecté el ID del alumno. Recargá la página y reintentá.', 'error');
      return;
    }
    if (!planillaId) {
      showToast('Falta seleccionar planilla', 'error');
      return;
    }
    if (!confirm(`Cargar planilla "${PLANILLAS.find(p => p.id === planillaId)?.nombre}"? Reemplaza el curso actual.`)) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/load-planilla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planillaId, userId: uid }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Planilla cargada (${data.saved} modulos)`, 'success');
        // Refrescamos student tambien para que se actualice el planilla_id en el header
        setStudent((prev) => prev ? ({ ...prev, planilla_id: planillaId } as User) : prev);
        await loadStudentCourse();
      } else {
        showToast(data.error || `${data.saved || 0} cargados, errores`, 'error');
      }
    } catch { showToast('Error de conexion', 'error'); }
    setLoadingAction(false);
    setShowPlanillaMenu(false);
  }

  async function handleCopyFromStudent(fromUserId: string) {
    const fromStudent = allStudents.find(s => s.id === fromUserId);
    if (!confirm(`Copiar curso de "${fromStudent?.nombre}"?`)) return;
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
      } else { showToast(data.error || 'Error', 'error'); }
    } catch { showToast('Error de conexion', 'error'); }
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
          setAllStudents((data.students || []).filter((s: any) => s.id !== userId).map((s: any) => ({ id: s.id, nombre: s.nombre })));
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

  const completedIdsSet = new Set(metrics?.completedLessonIds || []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/admin')}
        className="flex items-center gap-2 text-jjl-muted hover:text-white transition-colors text-sm">
        <ArrowLeft className="h-4 w-4" /> Volver a Alumnos
      </button>

      {/* CRM Header (nuevo) */}
      <CrmHeader
        userId={userId}
        onScheduleClick={() => setShowSchedule(true)}
        onConfirmMonthClick={openConfirmMonth}
        refreshKey={crmRefreshKey}
      />

      {/* Planilla activa — visible PRIMERO, muy fácil de ver */}
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1">Planilla activa</p>
            {student?.planilla_id ? (
              <p className="text-lg font-bold text-white">
                {PLANILLAS.find((p) => p.id === student?.planilla_id)?.nombre || student?.planilla_id}
              </p>
            ) : (
              <p className="text-lg font-bold text-amber-400">⚠️ Sin planilla asignada</p>
            )}
          </div>
          <button
            onClick={() => setShowPlanillaMenu(!showPlanillaMenu)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-jjl-red text-white text-[13px] font-semibold hover:bg-jjl-red-hover"
          >
            {student?.planilla_id ? 'Cambiar' : 'Asignar planilla'}
            <ChevronDown className={`h-4 w-4 transition-transform ${showPlanillaMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {showPlanillaMenu && (
          <div className="mt-3 pt-3 border-t border-jjl-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PLANILLAS.map((planilla) => {
              const isActive = student?.planilla_id === planilla.id;
              return (
                <button
                  key={planilla.id}
                  disabled={loadingAction}
                  onClick={() => handleLoadPlanilla(planilla.id)}
                  className={`text-left p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                    isActive ? 'bg-jjl-red/10 border-jjl-red/40' : 'bg-white/[0.03] border-jjl-border hover:bg-white/[0.05]'
                  }`}
                >
                  <p className="text-sm font-bold text-white">{planilla.nombre} {isActive && '✓'}</p>
                  <p className="text-[11px] text-jjl-muted mt-0.5 line-clamp-2">{planilla.descripcion}</p>
                  <p className="text-[10px] text-jjl-muted/70 mt-1">{planilla.weeks.length} semanas</p>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Desbloqueo rápido por mes — solo si hay planilla + módulos cargados */}
      {student?.planilla_id && studentModules.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Desbloqueo rápido</p>
              <p className="text-[11px] text-jjl-muted mt-0.5">Click un mes para desbloquearle todos sus módulos al toque.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MONTH_RANGES.map((block) => {
              const blockModules = studentModules.filter((m) => block.semanas.includes(m.semana_numero));
              const total = blockModules.length;
              if (total === 0) return null;   // planilla no tiene este bloque (raro)
              const unlockedInBlock = blockModules.filter((m) => unlockedModules.has(m.id)).length;
              const allUnlocked = unlockedInBlock === total;
              const partial = unlockedInBlock > 0 && unlockedInBlock < total;
              return (
                <button
                  key={block.mes}
                  disabled={loadingAction || allUnlocked}
                  onClick={() => quickUnlockMonth(block.mes, block.label, total)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    allUnlocked
                      ? 'bg-green-500/10 border-green-500/40 text-green-300 cursor-default'
                      : partial
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
                        : 'bg-white/[0.03] border-jjl-border text-jjl-muted hover:border-jjl-red/40 hover:text-white'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-bold">{block.label}</p>
                    {allUnlocked && <span className="text-[14px]">✓</span>}
                  </div>
                  <p className="text-[10px] mt-0.5 opacity-80">{unlockedInBlock}/{total} desbloqueados</p>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Acceso al programa (separado del CRM porque es flag técnico, no de journey) */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Acceso al programa</p>
            <p className="text-[11px] text-jjl-muted">Habilita /dashboard, /modules, /upload, etc. Sin esto solo accede a /cursos.</p>
          </div>
          <Toggle
            checked={!!(student as User & { program_member?: boolean }).program_member}
            onChange={async (v) => {
              try {
                const res = await fetch('/api/admin/update-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, program_member: v }),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error || 'Error');
                setStudent((prev) => prev ? ({ ...prev, program_member: v } as User & { program_member: boolean }) : prev);
                showToast(v ? 'Acceso al programa activado' : 'Acceso revocado', 'success');
              } catch (e) {
                showToast(e instanceof Error ? e.message : 'Error', 'error');
              }
            }}
          />
        </div>
      </Card>

      {/* Section tabs — scrollable horizontal en mobile */}
      <div className="flex gap-1 bg-jjl-gray rounded-lg p-1 overflow-x-auto">
        {([
          { key: 'metricas' as SectionType, label: 'Métricas', icon: TrendingUp },
          { key: 'notas' as SectionType, label: 'Notas', icon: StickyNote },
          { key: 'timeline' as SectionType, label: 'Timeline', icon: History },
          { key: 'llamadas' as SectionType, label: 'Llamadas', icon: Phone },
          { key: 'videos' as SectionType, label: 'Videos', icon: VideoIcon },
          { key: 'curso' as SectionType, label: 'Curso', icon: FileSpreadsheet },
          { key: 'modulos' as SectionType, label: 'Módulos', icon: BookOpen },
        ]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeSection === key ? 'bg-jjl-red text-white' : 'text-jjl-muted hover:text-white'
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ========== NOTAS ========== */}
      {activeSection === 'notas' && <NotesTab userId={userId} />}

      {/* ========== TIMELINE ========== */}
      {activeSection === 'timeline' && <TimelineTab userId={userId} />}

      {/* ========== LLAMADAS ========== */}
      {activeSection === 'llamadas' && (
        <LlamadasTab userId={userId} onScheduleClick={() => setShowSchedule(true)} />
      )}

      {/* ========== METRICAS ========== */}
      {activeSection === 'metricas' && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-2xl font-bold">{metrics?.streak || 0}</p>
                  <p className="text-xs text-jjl-muted">Racha</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-2xl font-bold">{metrics?.totalTrainingDays || 0}</p>
                  <p className="text-xs text-jjl-muted">Dias entrenados</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold">{metrics?.completedLessonsCount || 0}</p>
                  <p className="text-xs text-jjl-muted">Lecciones</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold">{gamification?.puntos || 0}</p>
                  <p className="text-xs text-jjl-muted">Puntos</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Belt progress */}
          {gamification && (
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Progresion de Cinturon</h2>
                <Badge belt={gamification.newBelt} />
              </div>
              <div className="flex items-center gap-1">
                {['white', 'blue', 'purple', 'brown', 'black'].map((belt) => {
                  const beltIndex = ['white', 'blue', 'purple', 'brown', 'black'].indexOf(belt);
                  const currentIndex = ['white', 'blue', 'purple', 'brown', 'black'].indexOf(gamification.newBelt);
                  const achieved = beltIndex <= currentIndex;
                  return (
                    <div key={belt} className="flex-1">
                      <div className={`h-2 rounded-full ${achieved ? 'bg-jjl-red' : 'bg-jjl-gray-light'}`} />
                      <p className={`text-xs text-center mt-1 ${achieved ? 'text-white' : 'text-jjl-muted'}`}>
                        {BELT_LABELS[belt]}
                      </p>
                    </div>
                  );
                })}
              </div>
              {gamification.nextBelt && (
                <p className="text-xs text-jjl-muted mt-2">
                  Proximo: {BELT_LABELS[gamification.nextBelt.key]} (semana {gamification.nextBelt.week}) — {gamification.progressToNext}%
                </p>
              )}
            </Card>
          )}

          {/* Training Calendar */}
          <Card>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-jjl-red" />
              Calendario de Entrenamiento
            </h2>
            <MiniCalendar trainedDays={metrics?.trainedDays || []} />
          </Card>

          {/* Module progress */}
          <Card>
            <h2 className="font-semibold mb-3">Progreso por Modulo</h2>
            <div className="space-y-2">
              {studentModules.map((mod) => {
                const videoLessons = mod.lessons.filter((l) => l.tipo !== 'reflection');
                const completed = videoLessons.filter((l) => completedIdsSet.has(l.id)).length;
                const pct = videoLessons.length > 0 ? Math.round((completed / videoLessons.length) * 100) : 0;
                const isUnlocked = unlockedModules.has(mod.id);

                return (
                  <div key={mod.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-jjl-red w-8 shrink-0">
                      {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs truncate ${isUnlocked ? 'text-white' : 'text-jjl-muted'}`}>
                          {mod.titulo}
                        </span>
                        <span className="text-xs text-jjl-muted ml-2 shrink-0">{completed}/{videoLessons.length}</span>
                      </div>
                      <div className="w-full bg-jjl-gray-light rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Feedbacks */}
          <Card>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-jjl-red" />
              Feedbacks del Alumno
              {metrics?.feedbacks && metrics.feedbacks.length > 0 && (
                <span className="text-xs bg-jjl-red/20 text-jjl-red px-2 py-0.5 rounded-full">
                  {metrics.feedbacks.length}
                </span>
              )}
            </h2>
            {!metrics?.feedbacks?.length ? (
              <p className="text-sm text-jjl-muted py-4 text-center">Sin feedbacks todavia</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {metrics.feedbacks.map((fb, i) => (
                  <div key={i} className="border-l-2 border-jjl-red/50 pl-3 py-1">
                    <p className="text-xs text-jjl-muted mb-1">
                      {format(new Date(fb.fecha + 'T12:00:00'), 'EEEE d MMMM', { locale: es })}
                    </p>
                    <p className="text-sm text-white">{fb.texto}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ========== VIDEOS ========== */}
      {activeSection === 'videos' && <StudentVideos userId={userId} />}

      {/* ========== CURSO ========== */}
      {activeSection === 'curso' && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">Curso del Alumno</h2>
                <p className="text-xs text-jjl-muted mt-0.5">
                  {hasCourseData
                    ? `${studentModules.length} semanas cargadas${student?.planilla_id ? ` · Planilla: ${PLANILLAS.find(p => p.id === student?.planilla_id)?.nombre || student?.planilla_id}` : ''}`
                    : 'Sin curso asignado. Carga una planilla o copia de otro alumno.'
                  }
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm"
                onClick={() => { setShowPlanillaMenu(!showPlanillaMenu); setShowCopyMenu(false); }}
                disabled={loadingAction}>
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Cargar Planilla
              </Button>
              <Button variant="secondary" size="sm"
                onClick={() => { openCopyMenu(); setShowPlanillaMenu(false); }}
                disabled={loadingAction}>
                <Copy className="h-4 w-4 mr-1.5" /> Copiar de otro alumno
              </Button>
            </div>

            {showPlanillaMenu && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLANILLAS.map((planilla) => {
                  const isActive = student?.planilla_id === planilla.id;
                  return (
                    <button key={planilla.id} onClick={() => handleLoadPlanilla(planilla.id)}
                      disabled={loadingAction}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        isActive
                          ? 'border-green-500/50 bg-green-500/10'
                          : 'border-jjl-border hover:border-jjl-red bg-jjl-gray-light/50 hover:bg-jjl-gray-light'
                      }`}>
                      <Upload className="h-4 w-4 text-jjl-red shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{planilla.nombre}</p>
                          {isActive && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">ACTUAL</span>
                          )}
                        </div>
                        <p className="text-xs text-jjl-muted">{planilla.descripcion}</p>
                        <p className="text-[10px] text-jjl-muted mt-0.5">{planilla.weeks.length} semanas · {planilla.weeks.reduce((s, w) => s + w.lessons.length, 0)} lecciones</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {showCopyMenu && (
              <div className="mt-4 space-y-1 max-h-60 overflow-y-auto">
                {allStudents.length === 0 ? (
                  <p className="text-sm text-jjl-muted py-4 text-center">No hay otros alumnos</p>
                ) : (
                  allStudents.map((s) => (
                    <button key={s.id} onClick={() => handleCopyFromStudent(s.id)}
                      disabled={loadingAction}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jjl-gray-light text-left transition-colors">
                      <Avatar name={s.nombre} size="sm" />
                      <span className="text-sm">{s.nombre}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </Card>

          {/* Quick unlock */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold">Desbloqueo Rapido</h2>
              {saving && <div className="w-4 h-4 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />}
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
                  <button key={index} onClick={() => unlockUpTo(index)} disabled={saving !== null}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      allUnlocked ? 'bg-jjl-red/20 text-jjl-red border border-jjl-red/30'
                        : 'bg-jjl-gray-light border border-jjl-border text-jjl-muted hover:text-white'
                    }`}>
                    {allUnlocked && <Check className="h-3 w-3 inline mr-1" />}{label}
                  </button>
                );
              })}
              <button onClick={lockAll} disabled={saving !== null}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-900/30 border border-red-800/30 text-red-400 hover:text-red-300 transition-colors">
                Bloquear Todo
              </button>
            </div>
          </Card>
        </>
      )}

      {/* ========== MODULOS ========== */}
      {activeSection === 'modulos' && (
        <>
          {monthGroups.map((group) => (
            <Card key={group.label}>
              <h2 className="text-sm font-semibold text-jjl-red uppercase tracking-wider mb-3">{group.label}</h2>
              <div className="space-y-1">
                {group.modules.map((mod) => {
                  const isUnlocked = unlockedModules.has(mod.id);
                  const isExpanded = expandedModule === mod.id;
                  const lessons = mod.lessons || [];
                  const videoLessons = lessons.filter((l) => l.tipo !== 'reflection');
                  const videosWithUrl = videoLessons.filter((l) => l.youtube_id && l.youtube_id.length > 0);
                  const completedCount = videoLessons.filter((l) => completedIdsSet.has(l.id)).length;

                  return (
                    <div key={mod.id}>
                      <div className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                        isUnlocked ? 'bg-jjl-gray-light/50' : ''} ${isExpanded ? 'rounded-b-none' : ''}`}>
                        <button onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-jjl-muted shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-jjl-muted shrink-0" />}
                          <span className="text-xs font-bold text-jjl-red w-8 shrink-0">
                            {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                          </span>
                          <div className="min-w-0">
                            <span className={`text-sm truncate block ${isUnlocked ? 'text-white' : 'text-jjl-muted'}`}>
                              {mod.titulo}
                            </span>
                            <span className="text-xs text-jjl-muted">
                              {completedCount}/{videoLessons.length} completadas
                              {videosWithUrl.length < videoLessons.length && (
                                <span className="text-yellow-500 ml-1">({videosWithUrl.length}/{videoLessons.length} videos)</span>
                              )}
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/admin/edit/${mod.id}?userId=${userId}`}
                            className="p-1.5 rounded hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors"
                            title="Editar modulo">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <Toggle checked={isUnlocked} onChange={() => toggleModule(mod.id)} size="sm" />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-jjl-gray-light/20 rounded-b-lg border-t border-jjl-border/30 px-4 py-2 space-y-1">
                          {lessons.map((lesson, li) => (
                            <div key={lesson.id || li}
                              className={`flex items-center gap-2 py-1.5 text-xs ${
                                lesson.tipo === 'reflection' ? 'text-yellow-400' : 'text-jjl-muted'}`}>
                              <span className="w-5 text-right shrink-0 opacity-50">{li + 1}.</span>
                              {lesson.tipo === 'video' ? <Play className="h-3 w-3 shrink-0" />
                                : <span className="w-3 shrink-0 text-center">📝</span>}
                              <span className="flex-1 truncate">{lesson.titulo}</span>
                              {lesson.tipo === 'video' && (
                                completedIdsSet.has(lesson.id) ? (
                                  <Check className="h-3 w-3 text-green-400 shrink-0" />
                                ) : lesson.youtube_id ? (
                                  <span className="text-jjl-muted shrink-0">—</span>
                                ) : (
                                  <span className="text-red-400 shrink-0">sin video</span>
                                )
                              )}
                            </div>
                          ))}
                          <Link href={`/admin/edit/${mod.id}?userId=${userId}`}
                            className="flex items-center gap-1.5 text-xs text-jjl-red hover:text-white py-2 transition-colors">
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
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl ${
          toast.type === 'success' ? 'bg-green-900/90 border border-green-500/30 text-green-300'
            : 'bg-red-900/90 border border-red-500/30 text-red-300'}`}>
          {toast.type === 'success' && <Check className="h-4 w-4 inline mr-1.5" />}
          {toast.message}
        </div>
      )}

      {/* CRM modals */}
      {showSchedule && (
        <Schedule1on1Modal
          userId={userId}
          userName={student?.nombre || 'Alumno'}
          onClose={() => setShowSchedule(false)}
          onScheduled={() => {
            setShowSchedule(false);
            setCrmRefreshKey((k) => k + 1);
            showToast('1-on-1 agendada — notificación enviada al alumno', 'success');
          }}
        />
      )}
      {showConfirmMonth && confirmMonthCtx && (
        <ConfirmMonthDialog
          userId={userId}
          userName={student?.nombre || 'Alumno'}
          currentMesLabel={confirmMonthCtx.currentMesLabel}
          nextMesLabel={confirmMonthCtx.nextMesLabel}
          nextModulesPreview={confirmMonthCtx.nextModulesPreview}
          onClose={() => setShowConfirmMonth(false)}
          onConfirmed={(info) => {
            setShowConfirmMonth(false);
            setCrmRefreshKey((k) => k + 1);
            // refresh tambien los desbloqueos para reflejar en tab Módulos
            setUnlockedModules((prev) => {
              const next = new Set(prev);
              // optimista — el back ya desbloqueó; el refresh del Curso/Módulos
              // se hace en el próximo render si el user vuelve a ese tab.
              return next;
            });
            showToast(`Mes confirmado · ${info.unlocked_count} módulos desbloqueados`, 'success');
          }}
        />
      )}
    </div>
  );
}

// ---- Mini Calendar (GitHub-style, same as student but compact) ----
function MiniCalendar({ trainedDays }: { trainedDays: string[] }) {
  const { grid } = useMemo(() => {
    const today = new Date();
    const trainedSet = new Set(trainedDays);
    const weeks = 13;
    const todayDow = (getDay(today) + 6) % 7;
    const totalDays = (weeks - 1) * 7 + todayDow + 1;

    const gridWeeks: ({ dateStr: string; trained: boolean } | null)[][] = [];
    for (let w = 0; w < weeks; w++) {
      const week: ({ dateStr: string; trained: boolean } | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const daysAgo = totalDays - 1 - (w * 7 + d);
        if (daysAgo < 0) { week.push(null); }
        else {
          const date = subDays(today, daysAgo);
          const dateStr = format(date, 'yyyy-MM-dd');
          week.push({ dateStr, trained: trainedSet.has(dateStr) });
        }
      }
      gridWeeks.push(week);
    }
    return { grid: gridWeeks };
  }, [trainedDays]);

  const dayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex gap-1">
      <div className="flex flex-col gap-1 mr-1">
        {dayLabels.map((d) => (
          <div key={d} className="h-[12px] flex items-center">
            <span className="text-[9px] text-jjl-muted leading-none">{d}</span>
          </div>
        ))}
      </div>
      {grid.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1 flex-1">
          {week.map((cell, di) => (
            <div key={di}
              className={`h-[12px] rounded-sm ${
                !cell ? 'bg-transparent'
                  : cell.dateStr === todayStr
                  ? cell.trained ? 'bg-green-400 ring-1 ring-green-300' : 'bg-jjl-border ring-1 ring-jjl-muted/50'
                  : cell.trained ? 'bg-green-500/70' : 'bg-jjl-gray-light'
              }`}
              title={cell?.dateStr || ''}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

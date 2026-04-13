'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import { MOCK_MODULES } from '@/lib/mock-data';
import type { User } from '@/lib/supabase/types';

export default function AdminStudentPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [student, setStudent] = useState<User | null>(null);
  const [unlockedModules, setUnlockedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

    fetchData();
  }, [userId]);

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

    // Optimistic update
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
      console.error('Toggle module error:', err);
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error al guardar', 'error');
    }

    setSaving(null);
  }

  async function unlockUpTo(targetModuleIndex: number) {
    setSaving('batch');
    const modulesToUnlock = MOCK_MODULES.slice(0, targetModuleIndex + 1);
    const previousSet = new Set(unlockedModules);

    // Optimistic update
    const newSet = new Set(unlockedModules);
    modulesToUnlock.forEach((m) => newSet.add(m.id));
    setUnlockedModules(newSet);

    try {
      await saveAccess(modulesToUnlock.map((m) => ({ id: m.id, is_unlocked: true })));
      showToast(`${modulesToUnlock.length} modulos desbloqueados`, 'success');
    } catch (err: any) {
      console.error('Unlock batch error:', err);
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
      await saveAccess(MOCK_MODULES.map((m) => ({ id: m.id, is_unlocked: false })));
      showToast('Todos los modulos bloqueados', 'success');
    } catch (err: any) {
      console.error('Lock all error:', err);
      setUnlockedModules(previousSet);
      showToast(err.message || 'Error al bloquear', 'error');
    }

    setSaving(null);
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
    { label: 'Fundamentos', modules: MOCK_MODULES.filter((m) => m.semana_numero === 0) },
    { label: 'Mes 1 (S1-S4)', modules: MOCK_MODULES.filter((m) => m.semana_numero >= 1 && m.semana_numero <= 4) },
    { label: 'Mes 2 (S5-S8)', modules: MOCK_MODULES.filter((m) => m.semana_numero >= 5 && m.semana_numero <= 8) },
    { label: 'Mes 3 (S9-S12)', modules: MOCK_MODULES.filter((m) => m.semana_numero >= 9 && m.semana_numero <= 12) },
    { label: 'Mes 4 (S13-S16)', modules: MOCK_MODULES.filter((m) => m.semana_numero >= 13 && m.semana_numero <= 16) },
    { label: 'Mes 5 (S17-S20)', modules: MOCK_MODULES.filter((m) => m.semana_numero >= 17 && m.semana_numero <= 20) },
    { label: 'Mes 6 (S21-S24)', modules: MOCK_MODULES.filter((m) => m.semana_numero >= 21 && m.semana_numero <= 24) },
  ];

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
            const targetModules = MOCK_MODULES.slice(0, index + 1);
            const allUnlocked = targetModules.every((m) => unlockedModules.has(m.id));
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
              return (
                <div
                  key={mod.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isUnlocked ? 'bg-jjl-gray-light/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-jjl-red w-8 shrink-0">
                      {mod.semana_numero === 0 ? 'Intro' : `S${mod.semana_numero}`}
                    </span>
                    <span className={`text-sm truncate ${isUnlocked ? 'text-white' : 'text-jjl-muted'}`}>
                      {mod.titulo}
                    </span>
                  </div>
                  <Toggle
                    checked={isUnlocked}
                    onChange={() => toggleModule(mod.id)}
                    size="sm"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Toast notification */}
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

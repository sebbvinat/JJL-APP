'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, Upload, Check, AlertCircle, BookOpen, Play } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PLANILLAS, type Planilla } from '@/lib/planillas';

export default function PlanillasPage() {
  const router = useRouter();
  const [expandedPlanilla, setExpandedPlanilla] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleLoad(planillaId: string) {
    if (!confirm(`Esto va a cargar la planilla "${planillaId}" en los modulos. Los modulos existentes se van a sobrescribir. Continuar?`)) {
      return;
    }

    setLoading(planillaId);
    try {
      const res = await fetch('/api/admin/load-planilla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planillaId }),
      });

      const data = await res.json();

      if (data.success) {
        showToast(`Planilla "${planillaId}" cargada (${data.saved} modulos)`, 'success');
      } else if (data.errors) {
        showToast(`Cargados ${data.saved} modulos, ${data.errors.length} errores`, 'error');
      } else {
        showToast(data.error || 'Error al cargar', 'error');
      }
    } catch {
      showToast('Error de conexion', 'error');
    }
    setLoading(null);
  }

  const monthGroups = [
    { label: 'Fundamentos', range: [0, 0] },
    { label: 'Mes 1 (S1-S4)', range: [1, 4] },
    { label: 'Mes 2 (S5-S8)', range: [5, 8] },
    { label: 'Mes 3 (S9-S12)', range: [9, 12] },
    { label: 'Mes 4 (S13-S16)', range: [13, 16] },
    { label: 'Mes 5 (S17-S20)', range: [17, 20] },
    { label: 'Mes 6 (S21-S24)', range: [21, 24] },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin')}
            className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Cargar Planillas</h1>
            <p className="text-sm text-jjl-muted mt-1">
              Selecciona un programa para cargar su estructura de lecciones
            </p>
          </div>
        </div>
      </div>

      {/* Programs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANILLAS.map((planilla) => {
          const isEmpty = planilla.weeks.length === 0;
          const totalLessons = planilla.weeks.reduce((sum, w) => sum + w.lessons.length, 0);
          const totalVideos = planilla.weeks.reduce(
            (sum, w) => sum + w.lessons.filter((l) => l.tipo === 'video').length,
            0
          );
          const isExpanded = expandedPlanilla === planilla.id;

          return (
            <Card key={planilla.id} className={isEmpty ? 'opacity-50' : ''}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold">{planilla.nombre}</h2>
                  <p className="text-sm text-jjl-muted mt-1">{planilla.descripcion}</p>
                </div>
                {!isEmpty && (
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-2xl font-bold text-jjl-red">{planilla.weeks.length}</p>
                    <p className="text-xs text-jjl-muted">semanas</p>
                  </div>
                )}
              </div>

              {!isEmpty && (
                <div className="flex items-center gap-4 text-xs text-jjl-muted mb-4">
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3" /> {totalVideos} videos
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {totalLessons} lecciones total
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                {!isEmpty && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLoad(planilla.id)}
                      loading={loading === planilla.id}
                      disabled={loading !== null}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Cargar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedPlanilla(isExpanded ? null : planilla.id)}
                    >
                      {isExpanded ? 'Ocultar' : 'Ver estructura'}
                    </Button>
                  </>
                )}
                {isEmpty && (
                  <span className="text-xs text-jjl-muted italic">Proximamente</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Expanded planilla detail */}
      {expandedPlanilla && (() => {
        const planilla = PLANILLAS.find((p) => p.id === expandedPlanilla);
        if (!planilla) return null;

        return (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                Estructura: {planilla.nombre}
              </h2>
              <button
                onClick={() => setExpandedPlanilla(null)}
                className="text-sm text-jjl-muted hover:text-white"
              >
                Cerrar
              </button>
            </div>

            {monthGroups.map((group) => {
              const weeks = planilla.weeks.filter(
                (w) => w.semana_numero >= group.range[0] && w.semana_numero <= group.range[1]
              );
              if (weeks.length === 0) return null;

              return (
                <div key={group.label} className="mb-4">
                  <h3 className="text-sm font-semibold text-jjl-red uppercase tracking-wider mb-2">
                    {group.label}
                  </h3>
                  <div className="space-y-1">
                    {weeks.map((week) => {
                      const weekKey = `${planilla.id}-${week.semana_numero}`;
                      const isWeekExpanded = expandedWeek === weekKey;
                      const videoCount = week.lessons.filter((l) => l.tipo === 'video').length;

                      return (
                        <div key={weekKey}>
                          <button
                            onClick={() => setExpandedWeek(isWeekExpanded ? null : weekKey)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-jjl-gray-light/50 text-left transition-colors"
                          >
                            {isWeekExpanded ? (
                              <ChevronDown className="h-4 w-4 text-jjl-muted shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-jjl-muted shrink-0" />
                            )}
                            <span className="text-xs font-bold text-jjl-red w-8 shrink-0">
                              {week.semana_numero === 0 ? 'Intro' : `S${week.semana_numero}`}
                            </span>
                            <span className="text-sm flex-1">{week.titulo}</span>
                            <span className="text-xs text-jjl-muted">{videoCount} videos</span>
                          </button>

                          {isWeekExpanded && (
                            <div className="ml-12 py-1 space-y-0.5">
                              {week.lessons.map((lesson, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 py-1 text-xs ${
                                    lesson.tipo === 'reflection' ? 'text-yellow-400' : 'text-jjl-muted'
                                  }`}
                                >
                                  <span className="w-4 text-right opacity-50">{idx + 1}.</span>
                                  {lesson.tipo === 'video' ? (
                                    <Play className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <span className="w-3 text-center shrink-0">📝</span>
                                  )}
                                  <span>{lesson.titulo}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })()}

      {/* Info */}
      <Card>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm text-jjl-muted">
            <p className="font-medium text-white mb-1">Como funciona</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Al cargar una planilla se crean todas las lecciones en los modulos (sin videos)</li>
              <li>Despues podes ir a cada modulo desde la pagina de alumnos y agregar los links de YouTube</li>
              <li>Cargar una planilla sobrescribe las lecciones existentes de los modulos</li>
            </ul>
          </div>
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

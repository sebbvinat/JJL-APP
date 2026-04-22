'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, NotebookPen, Search, ChevronDown, Target, ShieldAlert, Eye,
  Dumbbell, Flame, TrendingUp,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

interface Student {
  id: string;
  nombre: string;
  avatar_url: string | null;
  cinturon_actual: string;
  lastEntry?: string | null;
  entriesCount?: number;
}

interface DiaryEntry {
  fecha: string;
  entreno_check: boolean;
  fatiga: string | null;
  intensidad: string | null;
  objetivo: string | null;
  objetivo_cumplido: boolean | null;
  regla: string | null;
  regla_cumplida: boolean | null;
  puntaje: number | null;
  observaciones: string | null;
  aprendizajes: string | null;
  notas: string | null;
  meta_entreno: string | null;
  feedback_texto: string | null;
}

export default function AdminDiariesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadStudents(); }, []);

  async function loadStudents() {
    try {
      const res = await fetch('/api/admin/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch {}
    setLoading(false);
  }

  async function selectStudent(student: Student) {
    setSelected(student);
    setEntries([]);
    setExpanded(null);
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/admin/student-diary?userId=${student.id}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {}
    setLoadingEntries(false);
  }

  const filtered = students.filter((s) =>
    s.nombre.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (selected) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelected(null); setEntries([]); }}
            className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Avatar src={selected.avatar_url} name={selected.nombre} />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{selected.nombre}</h1>
            <p className="text-xs text-jjl-muted">Diario — ultimos 30 dias</p>
          </div>
        </div>

        {loadingEntries ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-jjl-gray-light/50 rounded-xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <NotebookPen className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
              <p className="text-jjl-muted">Este alumno no registro nada en el diario</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => {
              const date = new Date(e.fecha + 'T12:00:00');
              const isExpanded = expanded === e.fecha;
              const hasDetail = !!(e.objetivo || e.regla || e.aprendizajes || e.observaciones || e.notas || e.meta_entreno);

              return (
                <Card key={e.fecha}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : e.fecha)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-14 text-center">
                        <p className="text-[10px] uppercase text-jjl-muted font-bold">
                          {format(date, 'MMM', { locale: es })}
                        </p>
                        <p className="text-xl font-black tabular-nums">{format(date, 'd')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold capitalize">
                          {format(date, 'EEEE', { locale: es })}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          {e.entreno_check ? (
                            <span className="text-green-400 inline-flex items-center gap-1">
                              <Dumbbell className="h-3 w-3" /> Entreno
                            </span>
                          ) : (
                            <span className="text-jjl-muted">Sin entreno</span>
                          )}
                          {e.fatiga && (
                            <span>{e.fatiga === 'verde' ? '🟢' : e.fatiga === 'amarillo' ? '🟡' : '🔴'}</span>
                          )}
                          {e.intensidad && (
                            <span className="text-jjl-muted">· {e.intensidad}</span>
                          )}
                        </div>
                      </div>
                      {e.puntaje != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          e.puntaje >= 7 ? 'text-green-400' :
                          e.puntaje >= 4 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {e.puntaje >= 9 ? 'Excelente' : e.puntaje >= 6 ? 'Bueno' : e.puntaje >= 4 ? 'Normal' : 'Regular'}
                        </span>
                      )}
                      {hasDetail && (
                        <ChevronDown className={`h-4 w-4 text-jjl-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </button>

                  {isExpanded && hasDetail && (
                    <div className="mt-3 pt-3 border-t border-jjl-border/30 space-y-2.5">
                      {e.objetivo && (
                        <DetailRow icon={Target} color="text-blue-400" label="Objetivo" value={e.objetivo} cumplido={e.objetivo_cumplido} />
                      )}
                      {e.regla && (
                        <DetailRow icon={ShieldAlert} color="text-orange-400" label="Regla" value={e.regla} cumplido={e.regla_cumplida} />
                      )}
                      {e.meta_entreno && (
                        <DetailRow icon={Target} color="text-jjl-red" label="Meta entreno" value={e.meta_entreno} />
                      )}
                      {e.aprendizajes && (
                        <DetailRow icon={TrendingUp} color="text-green-400" label="Aprendizajes" value={e.aprendizajes} />
                      )}
                      {e.observaciones && (
                        <DetailRow icon={Eye} color="text-jjl-muted" label="Observaciones" value={e.observaciones} />
                      )}
                      {e.notas && (
                        <DetailRow icon={NotebookPen} color="text-jjl-muted" label="Notas" value={e.notas} />
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Diarios de alumnos</h1>
          <p className="text-jjl-muted text-sm">Entradas de diario de cada alumno</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-jjl-muted pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar alumno..."
          className="w-full h-12 pl-10 pr-4 bg-white/[0.03] border border-jjl-border rounded-xl text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
        />
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-jjl-gray-light/50 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-center text-jjl-muted py-8">Sin alumnos</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((student) => (
            <button
              key={student.id}
              onClick={() => selectStudent(student)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-jjl-gray-light transition-colors text-left border border-transparent hover:border-jjl-border"
            >
              <Avatar src={student.avatar_url} name={student.nombre} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{student.nombre}</p>
                <p className="text-xs text-jjl-muted">Ver diario</p>
              </div>
              <ChevronDown className="h-4 w-4 text-jjl-muted rotate-[-90deg]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, color, label, value, cumplido }: {
  icon: any;
  color: string;
  label: string;
  value: string;
  cumplido?: boolean | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-bold">{label}</p>
        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{value}</p>
        {cumplido != null && (
          <p className={`text-[11px] mt-1 font-semibold ${cumplido ? 'text-green-400' : 'text-red-400'}`}>
            {cumplido ? '✓ Cumplido' : '✗ No cumplido'}
          </p>
        )}
      </div>
    </div>
  );
}

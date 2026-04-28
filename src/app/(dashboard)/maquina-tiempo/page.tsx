'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock, Plus, TrendingUp, TrendingDown, X, Save, Trash2,
  Zap, Star, Flame, Trophy, Target, Sparkles, Check, Circle, CheckCircle2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface Rating {
  id: string;
  semana: string;
  nivel: number;
  nota: string | null;
}

interface Task {
  id: string;
  texto: string;
  completada: boolean;
  completed_at: string | null;
  orden: number;
}

interface Skill {
  id: string;
  nombre: string;
  categoria: string | null;
  created_at: string;
  ratings: Rating[];
  tasks: Task[];
}

const TIERS = [
  { min: 1, max: 2, label: 'Novato',      emoji: '🥋' },
  { min: 3, max: 4, label: 'Aprendiz',    emoji: '📚' },
  { min: 5, max: 6, label: 'Practicante', emoji: '⚡' },
  { min: 7, max: 8, label: 'Guerrero',    emoji: '🔥' },
  { min: 9, max: 10, label: 'Maestro',    emoji: '👑' },
];

function getTier(nivel: number) {
  return TIERS.find((t) => nivel >= t.min && nivel <= t.max) || TIERS[0];
}

function getXP(nivel: number) {
  return Math.round((nivel / 10) ** 2 * 10000);
}

export default function MaquinaTiempoPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [levelUpSkill, setLevelUpSkill] = useState<{ skill: Skill; newLevel: number } | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newBaseLevel, setNewBaseLevel] = useState(3);
  const [newTaskInputs, setNewTaskInputs] = useState<string[]>(['']);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {}
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const tasks = newTaskInputs.map((t) => t.trim()).filter(Boolean);
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newName,
          categoria: newCategory,
          nivelBase: newBaseLevel,
          tasks,
        }),
      });
      if (res.ok) {
        setNewName('');
        setNewCategory('');
        setNewBaseLevel(3);
        setNewTaskInputs(['']);
        setShowAdd(false);
        load();
      }
    } catch {}
    setCreating(false);
  }

  async function handleDelete(skillId: string) {
    if (!confirm('Archivar esta habilidad?')) return;
    await fetch('/api/skills', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId }),
    });
    load();
  }

  async function toggleTask(skill: Skill, task: Task) {
    const willComplete = !task.completada;

    // Optimistic update
    setSkills((prev) => prev.map((s) => s.id === skill.id ? {
      ...s,
      tasks: s.tasks.map((t) => t.id === task.id ? { ...t, completada: willComplete } : t),
    } : s));

    const res = await fetch('/api/skills/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, completada: willComplete }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.leveledUp && willComplete) {
        // Show level up toast
        setLevelUpSkill({
          skill: { ...skill, ratings: [...skill.ratings, { id: 'tmp', semana: '', nivel: data.newLevel, nota: null }] },
          newLevel: data.newLevel,
        });
      }
      load();
    }
  }

  async function addTaskToSkill(skillId: string, texto: string) {
    if (!texto.trim()) return;
    await fetch('/api/skills/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, texto }),
    });
    load();
  }

  async function deleteTask(taskId: string) {
    await fetch('/api/skills/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    load();
  }

  // Sort skills by latest level desc
  const sortedSkills = [...skills].sort((a, b) => {
    const aLvl = a.ratings[a.ratings.length - 1]?.nivel || 0;
    const bLvl = b.ratings[b.ratings.length - 1]?.nivel || 0;
    return bLvl - aLvl;
  });

  const totalXP = skills.reduce((sum, s) => {
    const latest = s.ratings[s.ratings.length - 1];
    return sum + (latest ? getXP(latest.nivel) : 0);
  }, 0);

  const tasksCompleted = skills.reduce((sum, s) => sum + s.tasks.filter((t) => t.completada).length, 0);
  const tasksTotal = skills.reduce((sum, s) => sum + s.tasks.length, 0);

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="h-32 bg-jjl-gray-light/50 rounded-xl" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-jjl-gray-light/50 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-jjl-red/20 via-transparent to-transparent border border-jjl-red/20 p-5">
        <div className="absolute top-0 right-0 opacity-10">
          <Clock className="h-32 w-32 text-white" strokeWidth={0.5} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-jjl-red" />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-jjl-red">Habilidades</p>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Tu evolucion</h1>
          <p className="text-sm text-jjl-muted mt-1">Tick cada cosa que mejoras y subi de nivel</p>

          {skills.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-jjl-red" />
                  <span className="text-[9px] uppercase tracking-wider text-jjl-muted font-bold">XP Total</span>
                </div>
                <p className="text-xl font-black tabular-nums text-white mt-1">{totalXP.toLocaleString()}</p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-jjl-red" />
                  <span className="text-[9px] uppercase tracking-wider text-jjl-muted font-bold">Skills</span>
                </div>
                <p className="text-xl font-black tabular-nums text-white mt-1">{skills.length}</p>
              </div>
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-jjl-red" />
                  <span className="text-[9px] uppercase tracking-wider text-jjl-muted font-bold">Objetivos</span>
                </div>
                <p className="text-xl font-black tabular-nums text-white mt-1">{tasksCompleted}<span className="text-xs text-jjl-muted">/{tasksTotal}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva habilidad
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-jjl-red" />
            Nueva habilidad
          </h2>
          <div className="space-y-4">
            <Input
              id="sk-name"
              label="Habilidad"
              placeholder="Ej: Cross Knee, Guardia cerrada, Toreos"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              id="sk-cat"
              label="Categoria (opcional)"
              placeholder="Ej: Pasaje, Guardia"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />

            {/* Base level */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-2">
                Nivel actual (donde estas hoy)
              </label>
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-3 rounded-sm ${
                      i < newBaseLevel ? 'bg-jjl-red' : 'bg-white/[0.06]'
                    }`}
                    style={i < newBaseLevel ? { opacity: 0.4 + (i / 10) * 0.6 } : undefined}
                  />
                ))}
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={newBaseLevel}
                onChange={(e) => setNewBaseLevel(parseInt(e.target.value))}
                className="w-full accent-jjl-red"
              />
              <div className="flex justify-between text-[10px] text-jjl-muted">
                <span>{getTier(newBaseLevel).emoji} {getTier(newBaseLevel).label}</span>
                <span className="tabular-nums">{newBaseLevel}/10</span>
              </div>
            </div>

            {/* Tasks checklist */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-2">
                Cosas que tenes que mejorar
              </label>
              <p className="text-[11px] text-jjl-muted/70 mb-2">Cada una que tiques te sube de nivel</p>
              <div className="space-y-2">
                {newTaskInputs.map((txt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={txt}
                      onChange={(e) => {
                        const arr = [...newTaskInputs];
                        arr[i] = e.target.value;
                        setNewTaskInputs(arr);
                      }}
                      placeholder={i === 0 ? 'Ej: Bajar el codo antes de pasar' : 'Otra cosa a mejorar'}
                      className="flex-1 bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
                    />
                    {newTaskInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewTaskInputs(newTaskInputs.filter((_, idx) => idx !== i))}
                        className="p-2 text-jjl-muted hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewTaskInputs([...newTaskInputs, ''])}
                  className="text-xs text-jjl-red hover:text-jjl-red-hover font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Agregar otra
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
                Crear habilidad
              </Button>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {skills.length === 0 && !showAdd && (
        <Card>
          <div className="text-center py-10">
            <div className="text-6xl mb-3">🎯</div>
            <p className="font-bold text-lg">Empeza tu journey</p>
            <p className="text-sm text-jjl-muted mt-2 max-w-xs mx-auto">
              Agrega una habilidad, define tu nivel actual y lista las cosas a mejorar. Cada tick te sube de nivel.
            </p>
            <div className="flex gap-2 justify-center mt-4">
              {TIERS.map((t) => (
                <div key={t.label} className="flex flex-col items-center">
                  <span className="text-lg">{t.emoji}</span>
                  <span className="text-[9px] text-jjl-muted mt-0.5">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Skills list */}
      {sortedSkills.length > 0 && (
        <Card>
          <h2 className="text-[13px] font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-jjl-red" />
            Tus habilidades
          </h2>
          <div className="space-y-3">
            {sortedSkills.map((skill) => {
              const latest = skill.ratings[skill.ratings.length - 1];
              const nivel = latest?.nivel || 0;
              const tier = nivel > 0 ? getTier(nivel) : null;
              const isExpanded = expandedSkillId === skill.id;
              const pendingTasks = skill.tasks.filter((t) => !t.completada).length;
              const completedTasks = skill.tasks.filter((t) => t.completada).length;

              return (
                <div key={skill.id} className="border border-jjl-border rounded-xl overflow-hidden bg-jjl-gray-light/20">
                  {/* Bar row */}
                  <button
                    onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                    className="w-full p-3 group text-left"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {tier && <span className="text-base">{tier.emoji}</span>}
                        <span className="text-sm font-semibold text-white truncate">{skill.nombre}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pendingTasks > 0 && (
                          <span className="text-[10px] text-jjl-muted bg-white/5 px-1.5 py-0.5 rounded">
                            {pendingTasks} pendiente{pendingTasks !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-xs font-bold tabular-nums">
                          <span className="text-white">{nivel}</span><span className="text-jjl-muted">/10</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const filled = i < nivel;
                        return (
                          <div
                            key={i}
                            className={`flex-1 h-2.5 rounded-sm transition-all ${
                              filled
                                ? 'bg-jjl-red group-hover:bg-jjl-red-hover'
                                : 'bg-white/[0.06]'
                            }`}
                            style={filled ? { opacity: 0.4 + (i / 10) * 0.6 } : undefined}
                          />
                        );
                      })}
                    </div>
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-jjl-border/50 pt-3">
                      {/* Task checklist */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-bold mb-2 flex items-center justify-between">
                          <span>Cosas a mejorar</span>
                          {skill.tasks.length > 0 && (
                            <span>{completedTasks}/{skill.tasks.length}</span>
                          )}
                        </p>
                        {skill.tasks.length === 0 ? (
                          <p className="text-xs text-jjl-muted italic mb-2">Sin objetivos. Agrega uno abajo.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {skill.tasks.map((task) => (
                              <li key={task.id} className="flex items-start gap-2 group">
                                <button
                                  onClick={() => toggleTask(skill, task)}
                                  className="shrink-0 mt-0.5"
                                >
                                  {task.completada ? (
                                    <CheckCircle2 className="h-5 w-5 text-jjl-red" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-jjl-muted hover:text-jjl-red transition-colors" />
                                  )}
                                </button>
                                <span className={`flex-1 text-sm ${task.completada ? 'text-jjl-muted line-through' : 'text-white'}`}>
                                  {task.texto}
                                </span>
                                <button
                                  onClick={() => deleteTask(task.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-jjl-muted hover:text-red-400 transition-opacity"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Add task inline */}
                        <AddTaskInline onAdd={(txt) => addTaskToSkill(skill.id, txt)} />
                      </div>

                      {/* Mini tier/XP summary */}
                      {latest && tier && (
                        <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-[10px] uppercase text-jjl-muted font-bold tracking-wider">Tier</p>
                            <p className="text-sm font-bold">{tier.emoji} {tier.label}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase text-jjl-muted font-bold tracking-wider">XP</p>
                            <p className="text-sm font-bold tabular-nums">{getXP(latest.nivel).toLocaleString()}</p>
                          </div>
                        </div>
                      )}

                      {/* Evolution chart */}
                      {skill.ratings.length > 1 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-bold mb-2 flex items-center gap-1">
                            <Flame className="h-3 w-3 text-jjl-red" />
                            Evolucion ({skill.ratings.length} sem)
                          </p>
                          <div className="flex items-end gap-1 h-14 bg-black/30 rounded-lg p-2">
                            {skill.ratings.slice(-12).map((r) => (
                              <div
                                key={r.id}
                                className="flex-1 flex flex-col justify-end"
                                title={`${format(parseISO(r.semana), 'd MMM', { locale: es })}: ${r.nivel}/10`}
                              >
                                <div
                                  className="rounded bg-jjl-red"
                                  style={{ height: `${r.nivel * 10}%`, opacity: 0.3 + (r.nivel / 10) * 0.7 }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDelete(skill.id)}
                          className="text-xs text-jjl-muted hover:text-red-400 flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Archivar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Level up toast */}
      {levelUpSkill && <LevelUpToast skill={levelUpSkill.skill} newLevel={levelUpSkill.newLevel} onClose={() => setLevelUpSkill(null)} />}
    </div>
  );
}

function AddTaskInline({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-jjl-red hover:text-jjl-red-hover font-semibold flex items-center gap-1 mt-2"
      >
        <Plus className="h-3 w-3" /> Agregar objetivo
      </button>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) { onAdd(text); setText(''); setOpen(false); }
          if (e.key === 'Escape') { setOpen(false); setText(''); }
        }}
        placeholder="Ej: Entrar al pase cuando se sienta"
        className="flex-1 bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
      />
      <button
        onClick={() => { if (text.trim()) { onAdd(text); setText(''); setOpen(false); } }}
        className="px-3 py-2 bg-jjl-red text-white rounded-lg text-xs font-semibold hover:bg-jjl-red-hover"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}

function LevelUpToast({ skill, newLevel, onClose }: { skill: Skill; newLevel: number; onClose: () => void }) {
  const tier = getTier(newLevel);

  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center p-4">
      <div className="pointer-events-auto rounded-2xl p-6 text-center bg-gradient-to-br from-jjl-red to-jjl-red-hover shadow-2xl max-w-sm animate-scale-in border-2 border-white/10">
        <div className="text-7xl mb-2">{tier.emoji}</div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="h-6 w-6 text-white" />
          <p className="text-white font-black text-xl uppercase tracking-wider">Level Up!</p>
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <p className="text-white/90 text-sm">{skill.nombre}</p>
        <p className="text-white font-black text-2xl mt-2">Nivel {newLevel}/10</p>
        <p className="text-white/80 text-xs mt-1">{tier.label}</p>
        <button onClick={onClose} className="mt-4 text-white/80 text-xs underline">Cerrar</button>
      </div>
    </div>
  );
}

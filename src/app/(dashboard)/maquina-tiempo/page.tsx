'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Clock, Plus, TrendingUp, TrendingDown, X, Save, Trash2,
  Zap, Star, Flame, Trophy, Target, Sparkles,
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

interface Skill {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  created_at: string;
  ratings: Rating[];
}

// Monochrome tiers — only JJL red + grays, no extra colors
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
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [ratingSkill, setRatingSkill] = useState<Skill | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingNote, setRatingNote] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [levelUpSkill, setLevelUpSkill] = useState<Skill | null>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

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
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newName, categoria: newCategory, descripcion: newDesc }),
      });
      if (res.ok) {
        setNewName('');
        setNewCategory('');
        setNewDesc('');
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

  function openRating(skill: Skill) {
    const latest = skill.ratings[skill.ratings.length - 1];
    setRatingValue(latest?.nivel || 5);
    setRatingNote('');
    setRatingSkill(skill);
  }

  async function handleRate() {
    if (!ratingSkill) return;
    setSavingRating(true);
    const previousLevel = ratingSkill.ratings[ratingSkill.ratings.length - 1]?.nivel;
    try {
      await fetch('/api/skills/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: ratingSkill.id,
          nivel: ratingValue,
          nota: ratingNote,
        }),
      });

      const prevTier = previousLevel ? getTier(previousLevel) : null;
      const newTier = getTier(ratingValue);
      if (prevTier && prevTier.label !== newTier.label && ratingValue > (previousLevel || 0)) {
        setLevelUpSkill({ ...ratingSkill, ratings: [...ratingSkill.ratings, { id: 'tmp', semana: '', nivel: ratingValue, nota: null }] });
      }

      setRatingSkill(null);
      load();
    } catch {}
    setSavingRating(false);
  }

  // Sort skills by latest rating desc for the RPG bar list
  const sortedSkills = [...skills].sort((a, b) => {
    const aLvl = a.ratings[a.ratings.length - 1]?.nivel || 0;
    const bLvl = b.ratings[b.ratings.length - 1]?.nivel || 0;
    return bLvl - aLvl;
  });

  const totalXP = skills.reduce((sum, s) => {
    const latest = s.ratings[s.ratings.length - 1];
    return sum + (latest ? getXP(latest.nivel) : 0);
  }, 0);

  const skillsLevelUp = skills.filter((s) => {
    if (s.ratings.length < 2) return false;
    return s.ratings[s.ratings.length - 1].nivel > s.ratings[0].nivel;
  }).length;

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="h-32 bg-jjl-gray-light/50 rounded-xl" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-jjl-gray-light/50 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-8">
      {/* Hero header - JJL red only */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-jjl-red/20 via-transparent to-transparent border border-jjl-red/20 p-5">
        <div className="absolute top-0 right-0 opacity-10">
          <Clock className="h-32 w-32 text-white" strokeWidth={0.5} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-jjl-red" />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-jjl-red">Maquina del Tiempo</p>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Tu evolucion</h1>
          <p className="text-sm text-jjl-muted mt-1">Entrena las habilidades que queres dominar</p>

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
                  <TrendingUp className="h-3.5 w-3.5 text-jjl-red" />
                  <span className="text-[9px] uppercase tracking-wider text-jjl-muted font-bold">Mejoras</span>
                </div>
                <p className="text-xl font-black tabular-nums text-white mt-1">{skillsLevelUp}</p>
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
            Nueva habilidad a dominar
          </h2>
          <div className="space-y-3">
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
              placeholder="Ej: Pasaje, Guardia, Finalizaciones"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
                Por que queres mejorar (opcional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="Ej: No logro entrar al pasaje cuando el oponente se sienta"
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-4 py-3 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
                Crear
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
              Agrega habilidades que queres dominar. Autoevaluate cada semana y mira como subis de tier con el tiempo.
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

      {/* RPG-style skill bars list */}
      {sortedSkills.length > 0 && (
        <Card>
          <h2 className="text-[13px] font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-jjl-red" />
            Tus habilidades
          </h2>
          <div className="space-y-2.5">
            {sortedSkills.map((skill) => {
              const latest = skill.ratings[skill.ratings.length - 1];
              const nivel = latest?.nivel || 0;
              const tier = nivel > 0 ? getTier(nivel) : null;
              const isExpanded = expandedSkillId === skill.id;

              return (
                <div key={skill.id}>
                  {/* Bar row */}
                  <button
                    onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                    className="w-full group"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {tier && <span className="text-sm">{tier.emoji}</span>}
                        <span className="text-sm font-semibold text-white truncate text-left">{skill.nombre}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-jjl-muted shrink-0">
                        <span className="text-white">{nivel}</span>/10
                      </span>
                    </div>
                    {/* 10-segment RPG bar */}
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

                  {/* Expanded card */}
                  {isExpanded && (
                    <div className="mt-3 mb-1">
                      <SkillDetail skill={skill} onRate={openRating} onDelete={handleDelete} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Rating modal */}
      {ratingSkill && (
        <RatingModal
          skill={ratingSkill}
          nivel={ratingValue}
          setNivel={setRatingValue}
          nota={ratingNote}
          setNota={setRatingNote}
          onClose={() => setRatingSkill(null)}
          onSave={handleRate}
          saving={savingRating}
        />
      )}

      {/* Level up toast */}
      {levelUpSkill && <LevelUpToast skill={levelUpSkill} onClose={() => setLevelUpSkill(null)} />}
    </div>
  );
}

function SkillDetail({ skill, onRate, onDelete }: {
  skill: Skill;
  onRate: (s: Skill) => void;
  onDelete: (id: string) => void;
}) {
  const latest = skill.ratings[skill.ratings.length - 1];
  const first = skill.ratings[0];
  const delta = latest && first ? latest.nivel - first.nivel : 0;
  const tier = latest ? getTier(latest.nivel) : null;
  const xp = latest ? getXP(latest.nivel) : 0;
  const weeksTracking = skill.ratings.length;

  return (
    <div className="rounded-xl border border-jjl-border bg-jjl-gray-light/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {skill.categoria && (
            <p className="text-[10px] text-jjl-muted uppercase tracking-wider font-semibold">{skill.categoria}</p>
          )}
          {skill.descripcion && (
            <p className="text-sm text-jjl-muted mt-1">{skill.descripcion}</p>
          )}
        </div>
        <button
          onClick={() => onDelete(skill.id)}
          className="p-2 text-jjl-muted hover:text-red-400 rounded-lg hover:bg-red-900/20 shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {latest && tier ? (
        <>
          {/* Tier + XP */}
          <div className="flex items-center justify-between bg-black/30 rounded-xl p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-jjl-red">Tier actual</p>
              <p className="text-2xl font-black text-white">{tier.emoji} {tier.label}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Zap className="h-3 w-3 text-jjl-red" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-jjl-red">XP</p>
              </div>
              <p className="text-xl font-black text-white tabular-nums">{xp.toLocaleString()}</p>
              {delta !== 0 && (
                <div className={`flex items-center gap-0.5 text-xs font-bold justify-end ${
                  delta > 0 ? 'text-jjl-red' : 'text-jjl-muted'
                }`}>
                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta > 0 ? '+' : ''}{delta}
                </div>
              )}
            </div>
          </div>

          {/* Evolution chart - monochrome red */}
          {skill.ratings.length > 1 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-bold mb-2 flex items-center gap-1">
                <Flame className="h-3 w-3 text-jjl-red" />
                Evolucion ({weeksTracking} sem)
              </p>
              <div className="flex items-end gap-1 h-16 bg-black/30 rounded-lg p-2">
                {skill.ratings.slice(-12).map((r) => (
                  <div
                    key={r.id}
                    className="flex-1 flex flex-col justify-end"
                    title={`${format(parseISO(r.semana), "d MMM", { locale: es })}: Nivel ${r.nivel}`}
                  >
                    <div
                      className="rounded bg-jjl-red transition-opacity"
                      style={{ height: `${r.nivel * 10}%`, opacity: 0.3 + (r.nivel / 10) * 0.7 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {latest.nota && (
            <div className="rounded-lg p-3 border-l-2 border-jjl-red bg-white/[0.03]">
              <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-bold mb-1">Ultima nota</p>
              <p className="text-sm text-white leading-relaxed">{latest.nota}</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-black/30 rounded-xl p-4 text-center">
          <div className="text-3xl mb-2">🌱</div>
          <p className="text-sm font-semibold">Listo para empezar</p>
          <p className="text-xs text-jjl-muted mt-1">Autoevaluate para activar el tracking</p>
        </div>
      )}

      <Button variant="primary" size="md" onClick={() => onRate(skill)} className="w-full">
        <Star className="h-4 w-4 mr-1.5" />
        {latest ? 'Puntuar semana' : 'Empezar tracking'}
      </Button>
    </div>
  );
}

function RatingModal({ skill, nivel, setNivel, nota, setNota, onClose, onSave, saving }: {
  skill: Skill;
  nivel: number;
  setNivel: (n: number) => void;
  nota: string;
  setNota: (n: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const tier = getTier(nivel);
  const xp = getXP(nivel);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-jjl-gray border border-jjl-red/30 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{skill.nombre}</h3>
            <p className="text-xs text-jjl-muted">Como estas esta semana?</p>
          </div>
          <button onClick={onClose} className="p-2 text-jjl-muted hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tier preview - monochrome */}
        <div className="rounded-xl p-5 text-center bg-gradient-to-br from-jjl-red/20 via-jjl-gray to-jjl-gray border border-jjl-red/20">
          <div className="text-6xl mb-1">{tier.emoji}</div>
          <p className="text-white font-black text-2xl">{tier.label}</p>
          <p className="text-jjl-muted text-sm">Nivel {nivel}/10</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <Zap className="h-4 w-4 text-jjl-red" />
            <p className="text-white font-bold text-lg tabular-nums">{xp.toLocaleString()} XP</p>
          </div>
        </div>

        {/* Skill bar preview */}
        <div>
          <div className="flex gap-0.5 mb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-3 rounded-sm ${
                  i < nivel ? 'bg-jjl-red' : 'bg-white/[0.06]'
                }`}
                style={i < nivel ? { opacity: 0.4 + (i / 10) * 0.6 } : undefined}
              />
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={nivel}
            onChange={(e) => setNivel(parseInt(e.target.value))}
            className="w-full accent-jjl-red h-2"
          />
          <div className="flex justify-between mt-1">
            {TIERS.map((t) => (
              <span key={t.label} className="text-[10px]">{t.emoji}</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
            Nota (opcional)
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Que mejoraste? Que sigue trabado?"
            className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-4 py-3 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
          />
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={onSave} loading={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          Guardar y ganar XP
        </Button>
      </div>
    </div>
  );
}

function LevelUpToast({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const latest = skill.ratings[skill.ratings.length - 1];
  const tier = getTier(latest.nivel);

  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center p-4">
      <div className="pointer-events-auto rounded-2xl p-6 text-center bg-gradient-to-br from-jjl-red to-jjl-red-hover shadow-2xl max-w-sm animate-scale-in border-2 border-white/10">
        <div className="text-7xl mb-2">{tier.emoji}</div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="h-6 w-6 text-white" />
          <p className="text-white font-black text-xl uppercase tracking-wider">Tier Up!</p>
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <p className="text-white/90 text-sm">{skill.nombre}</p>
        <p className="text-white font-black text-2xl mt-2">{tier.label}</p>
        <button onClick={onClose} className="mt-4 text-white/80 text-xs underline">Cerrar</button>
      </div>
    </div>
  );
}

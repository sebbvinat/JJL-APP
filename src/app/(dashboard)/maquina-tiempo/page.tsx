'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Plus, TrendingUp, TrendingDown, Minus, X, Save, Trash2 } from 'lucide-react';
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
  ratings: Rating[];
}

const NIVEL_LABELS: Record<number, string> = {
  1: 'Principiante', 2: 'Muy basico', 3: 'Basico', 4: 'Aprendiendo',
  5: 'Intermedio', 6: 'Funciona a veces', 7: 'Consistente',
  8: 'Solido', 9: 'Dominio', 10: 'Maestria',
};

function nivelColor(n: number) {
  if (n >= 8) return 'text-green-400';
  if (n >= 6) return 'text-blue-400';
  if (n >= 4) return 'text-yellow-400';
  return 'text-red-400';
}

function nivelBg(n: number) {
  if (n >= 8) return 'bg-green-500';
  if (n >= 6) return 'bg-blue-500';
  if (n >= 4) return 'bg-yellow-500';
  return 'bg-red-500';
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
    if (!confirm('Archivar esta habilidad? Los registros se conservan.')) return;
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
      setRatingSkill(null);
      load();
    } catch {}
    setSavingRating(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-jjl-gray-light/50 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-jjl-red" />
            <h1 className="text-2xl font-bold">Maquina del Tiempo</h1>
          </div>
          <p className="text-jjl-muted text-sm mt-1">Habilidades que queres mejorar y como progresas con el tiempo</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card>
          <h2 className="font-semibold mb-3">Nueva habilidad a trabajar</h2>
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

      {/* Skills list */}
      {skills.length === 0 && !showAdd ? (
        <Card>
          <div className="text-center py-10">
            <Clock className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
            <p className="font-semibold">Empeza a trackear habilidades</p>
            <p className="text-sm text-jjl-muted mt-1 max-w-xs mx-auto">
              Agrega las tecnicas que queres mejorar. Una vez por semana, autoevaluate de 1 a 10. Con el tiempo vas a ver tu progreso.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => {
            const latest = skill.ratings[skill.ratings.length - 1];
            const first = skill.ratings[0];
            const delta = latest && first ? latest.nivel - first.nivel : 0;

            return (
              <Card key={skill.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg">{skill.nombre}</h3>
                    {skill.categoria && (
                      <p className="text-xs text-jjl-muted uppercase tracking-wider mt-0.5">{skill.categoria}</p>
                    )}
                    {skill.descripcion && (
                      <p className="text-sm text-jjl-muted mt-1.5">{skill.descripcion}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    className="p-2 text-jjl-muted hover:text-red-400 rounded-lg hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {latest ? (
                  <>
                    {/* Current level */}
                    <div className="bg-jjl-gray-light/30 rounded-xl p-4 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">Nivel actual</p>
                          <p className={`text-3xl font-black tabular-nums ${nivelColor(latest.nivel)}`}>
                            {latest.nivel}<span className="text-base text-jjl-muted">/10</span>
                          </p>
                          <p className="text-xs text-jjl-muted mt-1">{NIVEL_LABELS[latest.nivel]}</p>
                        </div>
                        {skill.ratings.length > 1 && (
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold mb-1">Progreso</p>
                            <div className={`flex items-center gap-1 text-lg font-bold ${
                              delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-jjl-muted'
                            }`}>
                              {delta > 0 ? <TrendingUp className="h-5 w-5" /> :
                               delta < 0 ? <TrendingDown className="h-5 w-5" /> :
                               <Minus className="h-5 w-5" />}
                              {delta > 0 ? '+' : ''}{delta}
                            </div>
                            <p className="text-[10px] text-jjl-muted mt-0.5">desde inicio</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline sparkline */}
                    {skill.ratings.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold mb-2">
                          Historia ({skill.ratings.length} semana{skill.ratings.length !== 1 ? 's' : ''})
                        </p>
                        <div className="flex items-end gap-1 h-16">
                          {skill.ratings.slice(-12).map((r) => (
                            <div
                              key={r.id}
                              className="flex-1 group relative"
                              title={`${format(parseISO(r.semana), "d 'de' MMM", { locale: es })}: ${r.nivel}/10`}
                            >
                              <div
                                className={`rounded-t ${nivelBg(r.nivel)} opacity-70 hover:opacity-100 transition-opacity cursor-help`}
                                style={{ height: `${r.nivel * 10}%` }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-jjl-muted/60 mt-1">
                          <span>{format(parseISO(skill.ratings[Math.max(0, skill.ratings.length - 12)].semana), 'd MMM', { locale: es })}</span>
                          <span>Hoy</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-jjl-muted italic mb-3">Sin puntaje todavia. Autoevaluate para empezar a ver tu progreso.</p>
                )}

                <Button variant="primary" size="sm" onClick={() => openRating(skill)} className="w-full">
                  Puntuar esta semana
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rating modal */}
      {ratingSkill && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-jjl-gray border border-jjl-border rounded-xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">{ratingSkill.nombre}</h3>
                <p className="text-xs text-jjl-muted">Como estas esta semana?</p>
              </div>
              <button onClick={() => setRatingSkill(null)} className="p-1 text-jjl-muted hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-jjl-muted font-semibold">Nivel</span>
                <span className={`text-3xl font-black tabular-nums ${nivelColor(ratingValue)}`}>{ratingValue}/10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={ratingValue}
                onChange={(e) => setRatingValue(parseInt(e.target.value))}
                className="w-full accent-jjl-red"
              />
              <p className="text-sm text-center text-jjl-muted mt-1">{NIVEL_LABELS[ratingValue]}</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
                Nota (opcional)
              </label>
              <textarea
                value={ratingNote}
                onChange={(e) => setRatingNote(e.target.value)}
                rows={2}
                placeholder="Que mejoraste? Que sigue trabado?"
                className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-4 py-3 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
              />
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={handleRate} loading={savingRating}>
              <Save className="h-4 w-4 mr-1.5" />
              Guardar puntaje
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { MessageCircle, CheckCircle, Send } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface WeeklyReflectionProps {
  weekNumber: number;
  onComplete?: () => void;
  completed?: boolean;
}

export default function WeeklyReflection({ weekNumber, onComplete, completed = false }: WeeklyReflectionProps) {
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [weekCompleted, setWeekCompleted] = useState(false);
  const [submitted, setSubmitted] = useState(completed);

  const handleSubmit = () => {
    if (!answer1.trim() || !answer2.trim()) return;
    setSubmitted(true);
    onComplete?.();
  };

  const handleCompleteWeek = () => {
    setWeekCompleted(true);
    // TODO: Save to Supabase
  };

  if (submitted) {
    return (
      <Card>
        <div className="text-center py-8 space-y-4">
          <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Reflexion enviada</h3>
            <p className="text-sm text-jjl-muted mt-1">Semana {weekNumber} completada. Segui asi, guerrero!</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-jjl-red/20 rounded-lg flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-jjl-red" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Reflexion Semanal</h3>
            <p className="text-sm text-jjl-muted">Semana {weekNumber} — Responde con honestidad</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Pregunta 1 */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              1. Como te sentiste esta semana con el entrenamiento?
            </label>
            <textarea
              value={answer1}
              onChange={(e) => setAnswer1(e.target.value)}
              placeholder="Describe como fue tu experiencia esta semana..."
              className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-jjl-muted focus:outline-none focus:ring-2 focus:ring-jjl-red/50 resize-none"
              rows={4}
            />
          </div>

          {/* Pregunta 2 */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              2. Que te resulto mas dificil y que te salio mejor?
            </label>
            <textarea
              value={answer2}
              onChange={(e) => setAnswer2(e.target.value)}
              placeholder="Cuenta que tecnicas te costaron mas y cuales sentiste que mejoraste..."
              className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-jjl-muted focus:outline-none focus:ring-2 focus:ring-jjl-red/50 resize-none"
              rows={4}
            />
          </div>
        </div>
      </Card>

      {/* Completar semana */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={weekCompleted}
              onChange={() => setWeekCompleted(!weekCompleted)}
              className="h-5 w-5 rounded border-jjl-border bg-jjl-gray-light accent-jjl-red"
            />
            <span className="text-sm font-semibold">Completaste todos los drills de la semana?</span>
          </div>
        </div>
      </Card>

      <Button
        variant="primary"
        className="w-full"
        onClick={handleSubmit}
        disabled={!answer1.trim() || !answer2.trim() || !weekCompleted}
      >
        <Send className="h-4 w-4 mr-2" />
        Enviar reflexion y completar semana
      </Button>
    </div>
  );
}

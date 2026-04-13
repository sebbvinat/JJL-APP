'use client';

import { useState } from 'react';
import { Dumbbell, CheckCircle, Send } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface TaskDashboardProps {
  todayChecked?: boolean;
}

export default function TaskDashboard({ todayChecked = false }: TaskDashboardProps) {
  const [checked, setChecked] = useState(todayChecked);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCheckIn = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-in' }),
      });
      if (res.ok) setChecked(true);
    } catch {}
    setSaving(false);
  };

  const handleFeedback = async () => {
    if (!feedback.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', text: feedback }),
      });
      if (res.ok) setFeedbackSent(true);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Daily Check-in */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
              checked ? 'bg-green-500/20' : 'bg-jjl-red/20'
            }`}>
              {checked ? (
                <CheckCircle className="h-6 w-6 text-green-400" />
              ) : (
                <Dumbbell className="h-6 w-6 text-jjl-red" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">Entrenaste hoy?</h3>
              <p className="text-sm text-jjl-muted">
                {checked ? 'Excelente guerrero! Sigue asi.' : 'Registra tu entrenamiento diario'}
              </p>
            </div>
          </div>

          {!checked ? (
            <Button size="lg" onClick={handleCheckIn} loading={saving}>
              SI, ENTRENE
            </Button>
          ) : (
            <span className="text-green-400 font-semibold text-sm bg-green-500/10 px-4 py-2 rounded-lg">
              Registrado
            </span>
          )}
        </div>
      </Card>

      {/* Weekly Feedback */}
      <Card>
        <h3 className="font-semibold mb-3">Feedback semanal</h3>
        <p className="text-sm text-jjl-muted mb-3">
          Como te sientes con tu progreso esta semana? Algun area que quieras mejorar?
        </p>
        {feedbackSent ? (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 px-4 py-3 rounded-lg">
            <CheckCircle className="h-4 w-4" />
            Feedback enviado. Gracias por compartir!
          </div>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Escribe tu feedback aqui..."
              className="flex-1 bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 focus:ring-jjl-red/50 focus:border-jjl-red transition-colors resize-none h-20"
            />
            <Button variant="primary" className="self-end" onClick={handleFeedback} loading={saving}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

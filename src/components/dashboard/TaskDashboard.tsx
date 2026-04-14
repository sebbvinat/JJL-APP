'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Dumbbell, CheckCircle, Send } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface TaskDashboardProps {
  todayChecked?: boolean;
}

export default function TaskDashboard({ todayChecked = false }: TaskDashboardProps) {
  const [checked, setChecked] = useState(todayChecked);
  const [feedback, setFeedback] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleCheckIn = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-in',
          fecha: format(new Date(), 'yyyy-MM-dd'),
        }),
      });
      if (res.ok) {
        setChecked(true);
        toast.success('Entrenamiento registrado', 'Gran trabajo');
      } else {
        toast.error('No pudimos registrar el entrenamiento');
      }
    } catch (err) {
      logger.error('dashboard.checkin.failed', { err });
      toast.error('Error de conexion');
    }
    setSaving(false);
  };

  const handleFeedback = async () => {
    if (!feedback.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          text: feedback,
          fecha: format(new Date(), 'yyyy-MM-dd'),
        }),
      });
      if (res.ok) {
        setFeedbackSent(true);
        toast.success('Feedback enviado');
      } else {
        toast.error('No pudimos enviar el feedback');
      }
    } catch (err) {
      logger.error('dashboard.feedback.failed', { err });
      toast.error('Error de conexion');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Daily Check-in */}
      <Card className="relative overflow-hidden">
        {!checked && (
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full blur-3xl opacity-30"
            style={{
              background: 'radial-gradient(circle, rgba(220,38,38,0.5), transparent 70%)',
            }}
          />
        )}
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center ring-1 ${
                checked
                  ? 'bg-green-500/15 ring-green-500/30 text-green-400'
                  : 'bg-jjl-red/15 ring-jjl-red/30 text-jjl-red'
              }`}
            >
              {checked ? <CheckCircle className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[17px] text-white">Entrenaste hoy?</h3>
              <p className="text-[13px] text-jjl-muted mt-0.5">
                {checked ? 'Excelente. Sigue asi.' : 'Registra tu entrenamiento diario'}
              </p>
            </div>
          </div>

          {!checked ? (
            <Button size="md" onClick={handleCheckIn} loading={saving}>
              Si, entrene
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-green-400 font-semibold text-xs bg-green-500/10 border border-green-500/25 px-3 py-1.5 rounded-full">
              <CheckCircle className="h-3.5 w-3.5" />
              Registrado
            </span>
          )}
        </div>
      </Card>

      {/* Weekly Feedback */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[15px]">Feedback semanal</h3>
          <span className="text-[10px] uppercase tracking-[0.18em] text-jjl-muted/60 font-semibold">
            Opcional
          </span>
        </div>
        <p className="text-[13px] text-jjl-muted mb-4 leading-relaxed">
          Como te sentis con tu progreso esta semana? Algun area a mejorar?
        </p>
        {feedbackSent ? (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/25 px-4 py-3 rounded-lg animate-fade-in">
            <CheckCircle className="h-4 w-4" />
            Feedback enviado. Gracias por compartir.
          </div>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Escribe tu feedback aqui..."
              className="flex-1 bg-white/[0.03] border border-jjl-border rounded-lg px-3.5 py-2.5 text-white text-sm placeholder:text-jjl-muted/50 focus:outline-none focus:ring-2 focus:ring-jjl-red/25 focus:border-jjl-red transition-colors resize-none h-20"
            />
            <Button
              variant="primary"
              className="self-end"
              onClick={handleFeedback}
              loading={saving}
              aria-label="Enviar feedback"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

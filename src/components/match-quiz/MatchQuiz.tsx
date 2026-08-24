'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Trophy, Loader2 } from 'lucide-react';
import { QUIZ_QUESTIONS, type QuizAnswers, type Arquetipo, type BrechaBloque } from '@/lib/match-arquetipos';
import MatchResult from './MatchResult';

type QuizState = 'intro' | 'questions' | 'submitting' | 'result';

export default function MatchQuiz() {
  // Identidad anónima — UUID por sesión. Persiste en localStorage para que
  // si vuelve a abrir la pestaña no se pierda el progreso.
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return crypto.randomUUID();
    const existing = window.localStorage.getItem('jjl_match_session');
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem('jjl_match_session', fresh);
    return fresh;
  });

  const [state, setState] = useState<QuizState>('intro');
  const [step, setStep] = useState(0); // índice de pregunta actual
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [visionText, setVisionText] = useState('');
  const [result, setResult] = useState<{ arquetipo: Arquetipo; matchPct: number; brecha?: BrechaBloque[] } | null>(null);
  const [error, setError] = useState('');

  const totalSteps = QUIZ_QUESTIONS.length;
  const currentQuestion = QUIZ_QUESTIONS[step];
  const isLastQuestion = step === totalSteps - 1;
  const isVisionStep = currentQuestion?.id === 'vision';

  // Progreso visual (0-100)
  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step, totalSteps]);

  function selectOption(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    // Auto-avanzar después de un toque chico para que se sienta fluido
    setTimeout(() => {
      if (isLastQuestion) submit({ ...answers, [currentQuestion.id]: value });
      else setStep((s) => s + 1);
    }, 220);
  }

  async function submit(finalAnswers: Partial<QuizAnswers>) {
    setState('submitting');
    setError('');
    try {
      const res = await fetch('/api/leads/match-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ...finalAnswers,
          vision: visionText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular tu match');
      setResult(data.match);
      setState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
      setState('questions');
    }
  }

  // ── Intro screen ───────────────────────────────────────────────────────
  if (state === 'intro') {
    return (
      <div className="max-w-md mx-auto px-5 py-12 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-jjl-red/10 border border-jjl-red/30 mb-6">
          <Trophy className="h-7 w-7 text-jjl-red" strokeWidth={2.2} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-jjl-red font-bold mb-3">
          Jiu Jitsu Latino
        </p>
        <h1 className="text-4xl font-black text-white tracking-tight leading-tight">
          ¿A qué luchador<br />te parecés?
        </h1>
        <p className="mt-5 text-[15px] text-white/70 leading-relaxed">
          Un test de 90 segundos basado en tu cuerpo, tu estilo y las veces que entrenás.
          Al final te decimos a qué leyenda del jiu-jitsu se parece tu juego —
          y dónde está tu próximo salto.
        </p>
        <button
          onClick={() => {
            // Meta Pixel: dispara StartQuiz al apretar "Empezar el test".
            void import('@/lib/meta-pixel').then((m) =>
              m.trackStartQuiz('Quiz luchador'),
            );
            setState('questions');
          }}
          className="mt-8 inline-flex items-center justify-center gap-2 w-full h-13 px-6 bg-jjl-red hover:bg-jjl-red-hover text-white text-[15px] font-bold rounded-xl transition-colors shadow-[0_8px_24px_-8px_rgba(220,38,38,0.6)]"
          style={{ minHeight: '52px' }}
        >
          Empezar el test
          <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-4 text-[11px] text-jjl-muted">
          9 preguntas · sin email para empezar
        </p>
      </div>
    );
  }

  // ── Submitting ─────────────────────────────────────────────────────────
  if (state === 'submitting') {
    return (
      <div className="max-w-md mx-auto px-5 py-20 text-center">
        <Loader2 className="h-10 w-10 text-jjl-red animate-spin mx-auto mb-5" />
        <p className="text-[14px] text-white/80 font-semibold">Analizando tu juego…</p>
        <p className="mt-1 text-[12px] text-jjl-muted">Cruzando con 30 años de jiu-jitsu mundial</p>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────
  if (state === 'result' && result) {
    return (
      <MatchResult
        sessionId={sessionId}
        arquetipo={result.arquetipo}
        matchPct={result.matchPct}
        brecha={result.brecha}
      />
    );
  }

  // ── Questions ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-5 py-8">
      {/* Top bar: back + progress */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-jjl-muted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-jjl-red to-orange-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-jjl-muted shrink-0">
          {step + 1}/{totalSteps}
        </span>
      </div>

      {/* Question */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-red font-bold mb-2">
          Pregunta {step + 1}
        </p>
        <h2 className="text-[24px] font-bold text-white leading-tight tracking-tight">
          {currentQuestion.pregunta}
        </h2>
        {currentQuestion.subtitulo && (
          <p className="mt-2 text-[13px] text-white/60 leading-relaxed">
            {currentQuestion.subtitulo}
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 text-[12px] text-red-400">{error}</p>
      )}

      {/* Options o vision text */}
      <div className="mt-6 space-y-2.5">
        {isVisionStep ? (
          <>
            <textarea
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="Ej: más confianza arriba del tatami, ganar el respeto de los de cinturón mayor, divertirme sin pelear cada lucha..."
              rows={4}
              className="w-full bg-white/[0.03] border border-jjl-border hover:border-jjl-border-strong rounded-xl px-4 py-3 text-[15px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 transition-colors resize-none"
              autoFocus
            />
            <button
              onClick={() => submit({ ...answers })}
              disabled={visionText.trim().length < 5}
              className="w-full h-13 mt-2 px-6 bg-jjl-red hover:bg-jjl-red-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-bold rounded-xl transition-colors shadow-[0_8px_24px_-8px_rgba(220,38,38,0.6)] inline-flex items-center justify-center gap-2"
              style={{ minHeight: '52px' }}
            >
              Ver mi match
              <Trophy className="h-5 w-5" />
            </button>
          </>
        ) : (
          currentQuestion.options.map((opt) => {
            const selected = answers[currentQuestion.id as keyof QuizAnswers] === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => selectOption(opt.value)}
                className={`w-full text-left px-4 py-4 rounded-xl border transition-all duration-150 ${
                  selected
                    ? 'bg-jjl-red/15 border-jjl-red text-white'
                    : 'bg-white/[0.03] border-jjl-border hover:border-jjl-border-strong text-white/90'
                }`}
                style={{ minHeight: '56px' }}
              >
                <span className="text-[15px] font-medium leading-snug">
                  {opt.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

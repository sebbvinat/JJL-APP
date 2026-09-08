'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import {
  QUIZ_QUESTIONS,
  ARQUETIPOS,
  type QuizAnswers,
  type Arquetipo,
  type BrechaBloque,
} from '@/lib/match-arquetipos';
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

  // ── Intro ──────────────────────────────────────────────────────────────
  if (state === 'intro') {
    // Las caras son el gancho: ver contra quiénes se juega vale mucho más que
    // cualquier frase de bienvenida.
    const caras = Object.values(ARQUETIPOS);
    return (
      <div className="mx-auto max-w-md px-5 pb-16 pt-12">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.32em] text-jjl-red">
          Jiu Jitsu Latino
        </p>

        <h1 className="mt-6 text-center text-[42px] font-black leading-[0.98] tracking-[-0.035em] text-white">
          ¿A qué luchador
          <br />
          <span className="text-jjl-red">te parecés?</span>
        </h1>

        <p className="mx-auto mt-5 max-w-[19rem] text-center text-[15px] leading-relaxed text-white/60">
          Nueve preguntas sobre tu cuerpo, tu estilo y las veces que entrenás. Al final
          te decimos a qué leyenda se parece tu juego — y dónde está tu próximo salto.
        </p>

        {/* Los siete, en fila. Las fotos ya están, así que se ve el premio. */}
        <div className="mt-9">
          <div className="flex items-center justify-center -space-x-3">
            {caras.map((a, i) => (
              <div
                key={a.id}
                className="h-[52px] w-[52px] overflow-hidden rounded-full border-2 border-[#0b0b0b] bg-jjl-red/15 ring-1 ring-jjl-red/30"
                style={{ zIndex: caras.length - i }}
              >
                {a.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.foto} alt={a.nombre} width={52} height={52} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[13px] font-black text-jjl-red">
                    {a.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-white/40">
            Siete estilos. Uno se parece al tuyo.
          </p>
        </div>

        <button
          onClick={() => {
            // Meta Pixel: dispara StartQuiz al apretar "Empezar el test".
            void import('@/lib/meta-pixel').then((m) => m.trackStartQuiz('Quiz luchador'));
            setState('questions');
          }}
          className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-jjl-red px-6 text-[16px] font-bold text-white shadow-[0_14px_36px_-12px_rgba(220,38,38,0.95)] transition-colors hover:bg-jjl-red-hover"
          style={{ minHeight: '56px' }}
        >
          Empezar el test
          <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-4 text-center text-[11.5px] text-jjl-muted">
          60 segundos · sin email para empezar
        </p>
      </div>
    );
  }

  // ── Calculando ─────────────────────────────────────────────────────────
  if (state === 'submitting') {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 rounded-full bg-jjl-red/20 blur-xl" />
          <Loader2 className="relative h-16 w-16 animate-spin text-jjl-red" strokeWidth={1.5} />
        </div>
        <p className="mt-7 text-[15px] font-bold text-white">Analizando tu juego…</p>
        <p className="mt-1.5 text-[12.5px] text-jjl-muted">Cruzando con 30 años de jiu-jitsu mundial</p>
      </div>
    );
  }

  // ── Resultado ──────────────────────────────────────────────────────────
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

  // ── Preguntas ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-5 pb-12 pt-6">
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-jjl-muted transition-colors hover:bg-white/5 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-jjl-red transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-jjl-muted">
          {step + 1}<span className="text-white/25">/{totalSteps}</span>
        </span>
      </div>

      <h2 className="text-[26px] font-black leading-[1.15] tracking-[-0.025em] text-white">
        {currentQuestion.pregunta}
      </h2>
      {currentQuestion.subtitulo && (
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/50">
          {currentQuestion.subtitulo}
        </p>
      )}

      {error && <p className="mt-4 text-[12.5px] text-red-400">{error}</p>}

      <div className="mt-7 space-y-2.5">
        {isVisionStep ? (
          <>
            <textarea
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="Ej: más confianza arriba del tatami, ganar el respeto de los de cinturón mayor, divertirme sin pelear cada lucha..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-jjl-border bg-white/[0.03] px-4 py-3.5 text-[15px] leading-relaxed text-white transition-colors placeholder:text-jjl-muted/50 hover:border-jjl-border-strong focus:border-jjl-red focus:outline-none focus:ring-2 focus:ring-jjl-red/25"
              autoFocus
            />
            <button
              onClick={() => submit({ ...answers })}
              disabled={visionText.trim().length < 5}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-jjl-red px-6 text-[15.5px] font-bold text-white shadow-[0_14px_36px_-12px_rgba(220,38,38,0.95)] transition-colors hover:bg-jjl-red-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              style={{ minHeight: '56px' }}
            >
              Ver mi ficha
              <ArrowRight className="h-5 w-5" />
            </button>
          </>
        ) : (
          currentQuestion.options.map((opt) => {
            const selected = answers[currentQuestion.id as keyof QuizAnswers] === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => selectOption(opt.value)}
                className={`group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left transition-all duration-150 ${
                  selected
                    ? 'border-jjl-red bg-jjl-red/15 text-white'
                    : 'border-jjl-border bg-white/[0.03] text-white/90 hover:border-jjl-border-strong hover:bg-white/[0.06]'
                }`}
                style={{ minHeight: '58px' }}
              >
                {/* El punto da el estado sin depender del color de fondo, que
                    en pantallas con poco brillo casi no se distingue. */}
                <span
                  className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-colors ${
                    selected ? 'border-jjl-red bg-jjl-red' : 'border-white/20 group-hover:border-white/35'
                  }`}
                />
                <span className="text-[15px] font-medium leading-snug">{opt.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

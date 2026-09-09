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

type QuizState = 'intro' | 'datos' | 'questions' | 'submitting' | 'result';

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
  // Nombre, instagram y whatsapp se piden ANTES del test. Al final la
  // persona ya tiene lo que vino a buscar y no tiene motivo para dejarlos.
  const [nombre, setNombre] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [step, setStep] = useState(0); // índice de pregunta actual
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [result, setResult] = useState<{ arquetipo: Arquetipo; matchPct: number; brecha?: BrechaBloque[] } | null>(null);
  const [error, setError] = useState('');
  // Se enciende al primer intento de avanzar; hasta entonces no mostramos
  // ningun error, para no recibir a la persona con la pantalla en rojo.
  const [intento, setIntento] = useState(false);

  const totalSteps = QUIZ_QUESTIONS.length;
  const currentQuestion = QUIZ_QUESTIONS[step];
  const isLastQuestion = step === totalSteps - 1;

  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step, totalSteps]);

  function selectOption(value: string) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    // Auto-avanzar después de un toque chico para que se sienta fluido
    setTimeout(() => {
      if (isLastQuestion) submit({ ...answers, [currentQuestion.id]: value });
      else setStep((s) => s + 1);
    }, 220);
  }

  /**
   * Guarda el contacto apenas termina la pantalla de datos, antes de la
   * primera pregunta.
   *
   * Hasta ahora la fila se creaba recien al terminar el quiz: el que
   * abandonaba a mitad no dejaba ningun rastro y no habia forma de seguirlo.
   * Es best-effort — si falla, la persona sigue igual y el POST final vuelve
   * a mandar los mismos datos.
   */
  function guardarParcial() {
    try {
      fetch('/api/leads/match-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          parcial: true,
          nombre: nombre.trim(),
          instagram: instagram.trim(),
          whatsapp: whatsapp.trim(),
        }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {}
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
          nombre: nombre.trim(),
          instagram: instagram.trim(),
          whatsapp: whatsapp.trim(),
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
            setState('datos');
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

  // ── Tus datos ──────────────────────────────────────────────────────────
  // Van antes del test y no despues: cuando la ficha ya esta en pantalla la
  // persona consiguio lo que vino a buscar y no tiene ningun motivo para
  // dejar el contacto. Aca todavia lo tiene, y ademas explica para que es.
  if (state === 'datos') {
    // Que falta en cada campo. El boton NO se bloquea: se puede apretar
    // siempre y ahi se muestra el motivo. Un boton apagado sin explicacion
    // deja a la persona mirando la pantalla sin saber que hacer.
    const faltaNombre = nombre.trim().length < 2 ? 'Escribí tu nombre.' : null;
    const faltaIg =
      instagram.trim().replace(/^@/, '').length < 2
        ? 'Escribí tu usuario de Instagram.'
        : null;
    const digitos = whatsapp.replace(/[^0-9]/g, '').length;
    const faltaWpp =
      digitos === 0
        ? 'Escribí tu WhatsApp con código de país. Ej: +54 9 11 2345-6789'
        : digitos < 8
          ? 'Faltan números — poné el WhatsApp completo, con código de país.'
          : null;
    const completo = !faltaNombre && !faltaIg && !faltaWpp;

    return (
      <div className="mx-auto max-w-md px-5 pb-16 pt-6">
        <button
          onClick={() => setState('intro')}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-jjl-muted transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h2 className="mt-6 text-[28px] font-black leading-[1.1] tracking-[-0.03em] text-white">
          Antes de arrancar
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">
          Con esto armamos tu ficha. Guido la mira antes de responderte, así no
          arranca preguntándote lo que ya contestaste.
        </p>

        <div className="mt-7 space-y-3.5">
          <Campo
            value={nombre}
            onChange={setNombre}
            placeholder="Tu nombre"
            autoComplete="name"
            autoFocus
            error={intento ? faltaNombre : null}
          />
          <Campo
            value={instagram}
            onChange={setInstagram}
            placeholder="Tu Instagram (@usuario)"
            error={intento ? faltaIg : null}
          />
          <Campo
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder="Tu WhatsApp (con código de país)"
            tipo="tel"
            autoComplete="tel"
            error={intento ? faltaWpp : null}
          />
        </div>

        <button
          onClick={() => {
            if (!completo) {
              setIntento(true);
              // Lo llevamos al primer campo que falta, que en el celular
              // ademas abre el teclado en el lugar correcto.
              const i = [faltaNombre, faltaIg, faltaWpp].findIndex(Boolean);
              document.querySelectorAll('input')[i]?.focus();
              return;
            }
            guardarParcial();
            setState('questions');
          }}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-jjl-red px-6 text-[16px] font-bold text-white shadow-[0_14px_36px_-12px_rgba(220,38,38,0.95)] transition-colors hover:bg-jjl-red-hover"
          style={{ minHeight: '56px' }}
        >
          Empezar el test
          <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-4 text-center text-[11.5px] text-jjl-muted">
          9 preguntas · 60 segundos
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
        instagram={instagram}
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
        {currentQuestion.options.map((opt) => {
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
        })}
      </div>
    </div>
  );
}

function Campo({
  value, onChange, placeholder, autoComplete, autoFocus, tipo = 'text', error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  autoFocus?: boolean;
  /** 'tel' hace que el celular abra el teclado numerico. */
  tipo?: 'text' | 'tel';
  /** Que le falta a este campo. Null = esta bien o todavia no lo intento. */
  error?: string | null;
}) {
  return (
    <div>
      <input
        type={tipo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        className={`w-full rounded-2xl border bg-white/[0.03] px-4 py-3.5 text-[15px] text-white transition-colors placeholder:text-jjl-muted/50 focus:outline-none focus:ring-2 ${
          error
            ? 'border-jjl-red focus:border-jjl-red focus:ring-jjl-red/25'
            : 'border-jjl-border hover:border-jjl-border-strong focus:border-jjl-red focus:ring-jjl-red/25'
        }`}
      />
      {error && <p className="mt-1.5 px-1 text-[12.5px] text-jjl-red">{error}</p>}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  AtSign,
  Battery,
  Brain,
  Briefcase,
  CheckCircle2,
  Crown,
  Dumbbell,
  Eye,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Hourglass,
  Layers,
  Map as MapIcon,
  Pause,
  RefreshCcw,
  Sailboat,
  ShieldQuestion,
  Sparkles,
  Target,
  Trophy,
  Wind,
  Zap,
} from 'lucide-react';
import CalendlyEmbed from './CalendlyEmbed';
import PhoneCollect from './PhoneCollect';

type AnswerKey =
  | 'instagram'
  | 'ocupacion'
  | 'fortaleza'
  | 'limitacion'
  | 'estado'
  | 'vision'
  | 'compromiso';

interface Option {
  value: string;
  label: string;
  Icon: typeof Activity;
  // Si el lead elige una opción con disqualifies=true, no le mostramos el
  // calendario al final — recibe un mensaje pidiendo que vuelva cuando esté
  // listo.
  disqualifies?: boolean;
}

type QuizQuestion =
  | {
      kind: 'choice';
      key: AnswerKey;
      eyebrow: string;
      title: string;
      hint?: string;
      options: Option[];
    }
  | {
      kind: 'text';
      key: AnswerKey;
      eyebrow: string;
      title: string;
      hint?: string;
      placeholder: string;
      Icon: typeof Activity;
      // Permite saltar la pregunta (sin invalidar el quiz).
      optional?: boolean;
      // Limpia el valor antes de guardarlo (ej. quitar "@" de un usuario IG).
      sanitize?: (raw: string) => string;
    };

const QUESTIONS: QuizQuestion[] = [
  {
    kind: 'text',
    key: 'instagram',
    eyebrow: 'Tu Instagram',
    title: '¿Cuál es tu usuario de Instagram?',
    hint: 'Para conocerte un poco antes de la sesión. Sin "@".',
    placeholder: 'tu_usuario',
    Icon: AtSign,
    // Obligatorio: lo usamos para hacer follow-up por DM si no agendan.
    sanitize: (raw) => raw.trim().replace(/^@+/, '').replace(/\s+/g, ''),
  },
  {
    kind: 'choice',
    key: 'ocupacion',
    eyebrow: 'Tu situación',
    title: '¿Cómo es tu situación laboral hoy?',
    hint: 'Sirve para entender cuánto tiempo y energía tenés para entrenar.',
    options: [
      {
        value: 'estable',
        label: 'Trabajo estable / negocio estable',
        Icon: Briefcase,
      },
      {
        value: 'inestable',
        label: 'Trabajo inestable',
        Icon: Hourglass,
      },
      {
        value: 'jubilado',
        label: 'Jubilado',
        Icon: Sailboat,
      },
    ],
  },
  {
    kind: 'choice',
    key: 'fortaleza',
    eyebrow: 'Tu fortaleza',
    title: '¿Cuál sentís que es tu principal fortaleza física?',
    hint: 'Tu juego se construye sobre lo que ya hacés bien.',
    options: [
      { value: 'fuerza', label: 'Fuerza / potencia', Icon: Dumbbell },
      { value: 'cardio', label: 'Resistencia / cardio', Icon: Wind },
      { value: 'flexibilidad', label: 'Flexibilidad / movilidad', Icon: Footprints },
      { value: 'velocidad', label: 'Velocidad / explosividad', Icon: Zap },
    ],
  },
  {
    kind: 'choice',
    key: 'limitacion',
    eyebrow: 'Tu limitante',
    title: '¿Qué es lo que más te frena en el tatami?',
    hint: 'El obstáculo principal que sentís cuando entrenás o luchás.',
    options: [
      { value: 'cardio', label: 'Me canso rápido — falta resistencia', Icon: Wind },
      { value: 'movilidad', label: 'Me cuesta moverme / desplazarme', Icon: Footprints },
      { value: 'flexibilidad', label: 'Me falta flexibilidad', Icon: Activity },
      { value: 'coordinacion', label: 'Me cuesta coordinar movimientos', Icon: Gauge },
      { value: 'mental', label: 'Mental — confianza, foco', Icon: Brain },
    ],
  },
  {
    kind: 'choice',
    key: 'estado',
    eyebrow: 'Tu punto de partida',
    title: '¿En qué punto sentís que está hoy tu juego?',
    hint: 'Diagnóstico honesto — así el plan es real, no genérico.',
    options: [
      {
        value: 'estancado',
        label: 'Entreno, pero siento que mi nivel está estancado hace tiempo',
        Icon: Pause,
      },
      {
        value: 'noaplico',
        label: 'Me cuesta aplicar en lucha lo que entreno',
        Icon: ShieldQuestion,
      },
      {
        value: 'improviso',
        label: 'Improviso y no tengo una estrategia clara',
        Icon: Sparkles,
      },
      {
        value: 'inconsistente',
        label: 'Algunos días rindo bien, pero no soy consistente',
        Icon: Gauge,
      },
      {
        value: 'canso',
        label: 'Me canso rápido y mi nivel baja en los sparrings',
        Icon: Battery,
      },
      {
        value: 'cuerpo',
        label: 'Siento que mi cuerpo ya no responde igual y tengo que adaptar mi juego',
        Icon: HeartPulse,
      },
    ],
  },
  {
    kind: 'choice',
    key: 'vision',
    eyebrow: 'Tu punto ideal',
    title: '¿Cómo te gustaría que se vea tu juego de acá a 6 meses?',
    hint: 'A dónde querés llegar — el destino marca el camino.',
    options: [
      {
        value: 'claridad',
        label: 'Tener un juego claro donde sé qué hacer en cada situación',
        Icon: MapIcon,
      },
      {
        value: 'ritmo',
        label: 'Poder imponer mi ritmo y no depender del rival',
        Icon: Crown,
      },
      {
        value: 'estrategia',
        label: 'Dejar de improvisar y empezar a luchar con estrategia',
        Icon: Target,
      },
      {
        value: 'solidez',
        label: 'Sentirme sólido tanto atacando como defendiendo',
        Icon: Layers,
      },
    ],
  },
  {
    kind: 'choice',
    key: 'compromiso',
    eyebrow: 'Tu compromiso',
    title: '¿Qué tan comprometido estás con mejorar tu juego hoy?',
    hint: 'Sin filtros — la respuesta honesta nos dice cómo ayudarte.',
    options: [
      {
        value: 'serio',
        label: 'Quiero ordenar mi juego en serio y adaptarlo a mi realidad para subir de nivel',
        Icon: Trophy,
      },
      {
        value: 'moderado',
        label: 'Quiero mejorar, pero sin cambiar demasiado lo que ya vengo haciendo',
        Icon: Flame,
      },
      {
        value: 'viendo',
        label: 'Solo estoy viendo / no busco nada puntual',
        Icon: Eye,
        disqualifies: true,
      },
    ],
  },
];

interface EvaluationQuizProps {
  calendlyUrl: string;
}

export default function EvaluationQuiz({ calendlyUrl }: EvaluationQuizProps) {
  const [step, setStep] = useState(0); // 0..QUESTIONS.length, last = done
  const [answers, setAnswers] = useState<Partial<Record<AnswerKey, string>>>({});
  const [pickedValue, setPickedValue] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  const total = QUESTIONS.length;
  const isDone = step >= total;
  const currentQuestion = !isDone ? QUESTIONS[step] : null;
  const progressPct = isDone ? 100 : Math.round((step / total) * 100);

  // ¿El lead se autoexcluyó en alguna respuesta?
  const isDisqualified = useMemo(() => {
    return QUESTIONS.some((q) => {
      if (q.kind !== 'choice') return false;
      const ans = answers[q.key];
      if (!ans) return false;
      const opt = q.options.find((o) => o.value === ans);
      return Boolean(opt?.disqualifies);
    });
  }, [answers]);

  // Persist answers when the quiz is finished. Best-effort, ignore failures.
  useEffect(() => {
    if (!isDone) return;
    const payload = {
      session_id: sessionId,
      instagram: answers.instagram,
      ocupacion: answers.ocupacion,
      fortaleza: answers.fortaleza,
      limitacion: answers.limitacion,
      estado: answers.estado,
      vision: answers.vision,
      compromiso: answers.compromiso,
      disqualified: isDisqualified,
    };
    // Sólo las choice questions son obligatorias para considerar el quiz
    // "completo" — instagram y ocupacion son opcionales.
    if (
      !payload.fortaleza ||
      !payload.limitacion ||
      !payload.estado ||
      !payload.vision ||
      !payload.compromiso
    ) {
      return;
    }
    void fetch('/api/leads/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }, [isDone, answers, sessionId, isDisqualified]);

  // Cleanup any pending auto-advance timer on unmount.
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function pick(value: string) {
    if (!currentQuestion) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPickedValue(value);
    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: value }));
    // Small delay so the user sees their selection animate before advancing.
    advanceTimer.current = setTimeout(() => {
      setPickedValue(null);
      setStep((s) => s + 1);
    }, 320);
  }

  function back() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPickedValue(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function reset() {
    setAnswers({});
    setStep(0);
    setPickedValue(null);
  }

  if (isDone) {
    if (isDisqualified) {
      return <DisqualifiedScreen onReset={reset} />;
    }
    return (
      <QuizResult answers={answers} calendlyUrl={calendlyUrl} sessionId={sessionId} />
    );
  }

  const q = currentQuestion!;
  const selected = answers[q.key];

  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
      {/* Progress */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-jjl-red tracking-[0.18em] uppercase">
          {q.eyebrow}
        </span>
        <span className="text-[11px] text-jjl-muted font-mono">
          {step + 1} / {total}
        </span>
      </div>
      <div className="h-1 bg-jjl-border rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-jjl-red to-jjl-red-hover transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Question */}
      <h3 className="mt-5 text-xl sm:text-2xl font-bold leading-snug">{q.title}</h3>
      {q.hint && <p className="mt-1.5 text-[13px] text-jjl-muted">{q.hint}</p>}

      {q.kind === 'choice' ? (
        <div className="mt-5 space-y-2.5">
          {q.options.map(({ value, label, Icon }) => {
            const isPicked =
              pickedValue === value || (!pickedValue && selected === value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => pick(value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                  isPicked
                    ? 'bg-jjl-red/10 border-jjl-red text-white shadow-[0_0_0_3px_rgba(220,38,38,0.18)]'
                    : 'bg-white/[0.02] border-jjl-border text-white/85 hover:border-jjl-red/40 hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                    isPicked ? 'bg-jjl-red/20 text-jjl-red' : 'bg-jjl-border/50 text-jjl-muted'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[14px] font-medium">{label}</span>
                {isPicked && (
                  <CheckCircle2 className="h-4 w-4 ml-auto text-jjl-red shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <TextStep
          question={q}
          initialValue={selected || ''}
          onSubmit={(value) => {
            setAnswers((prev) => ({ ...prev, [q.key]: value }));
            setStep((s) => s + 1);
          }}
          onSkip={
            q.optional
              ? () => {
                  setAnswers((prev) => {
                    const copy = { ...prev };
                    delete copy[q.key];
                    return copy;
                  });
                  setStep((s) => s + 1);
                }
              : undefined
          }
        />
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between text-[12px] text-jjl-muted">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Anterior
          </button>
        ) : (
          <span>60 segundos · Sin email</span>
        )}
        <span>
          Pregunta {step + 1} de {total}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text-input step (para preguntas como Instagram u ocupación).
// ---------------------------------------------------------------------------

function TextStep({
  question,
  initialValue,
  onSubmit,
  onSkip,
}: {
  question: Extract<QuizQuestion, { kind: 'text' }>;
  initialValue: string;
  onSubmit: (value: string) => void;
  onSkip?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const Icon = question.Icon;

  function commit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleaned = question.sanitize ? question.sanitize(value) : value.trim();
    if (!cleaned && !question.optional) return;
    onSubmit(cleaned);
  }

  return (
    <form onSubmit={commit} className="mt-5 space-y-3" noValidate>
      <div className="flex items-stretch w-full bg-black/30 border border-jjl-border rounded-xl focus-within:border-jjl-red/60 overflow-hidden">
        <span className="flex items-center justify-center w-12 shrink-0 bg-white/[0.04] border-r border-jjl-border text-jjl-muted">
          <Icon className="h-4 w-4" />
        </span>
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block w-full bg-transparent border-0 outline-0 px-4 h-12 text-[16px] text-white placeholder:text-jjl-muted/60 focus:outline-none focus:ring-0"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 bg-jjl-red hover:bg-jjl-red-hover text-white font-semibold rounded-xl transition-colors"
        >
          Continuar
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="h-11 px-4 text-[13px] text-jjl-muted hover:text-white transition-colors"
          >
            Saltar
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Disqualified screen — el lead se autoexcluyó (eligió "Solo estoy viendo"
// en la pregunta de compromiso).
// ---------------------------------------------------------------------------

function DisqualifiedScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-border p-6 sm:p-7">
      <div className="flex items-center gap-2 text-jjl-muted text-[11px] font-semibold tracking-[0.18em] uppercase">
        <Eye className="h-4 w-4" />
        Sin agendar
      </div>
      <h3 className="mt-3 text-2xl font-bold leading-tight">
        De momento no podemos ayudarte.
      </h3>
      <p className="mt-3 text-[14px] text-white/85 leading-relaxed">
        Trabajamos solo con practicantes listos para ordenar su juego en serio. Cuando
        estés en ese momento, volvé a llenar el formulario y agendamos.
      </p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 text-[13px] text-jjl-muted hover:text-white transition-colors"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Volver a empezar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result screen — personalized hook + Calendly embed → phone collect.
// ---------------------------------------------------------------------------

const FORTALEZA_LABEL: Record<string, string> = {
  fuerza: 'fuerza y potencia',
  cardio: 'resistencia y cardio',
  flexibilidad: 'flexibilidad y movilidad',
  velocidad: 'velocidad y explosividad',
};

const LIMITACION_HOOK: Record<string, string> = {
  cardio: 'Trabajamos un juego que no se basa en quemar gas — sobrevivís lucha tras lucha.',
  movilidad: 'Diseñamos un estilo que no exige desplazamientos largos — economía de movimiento.',
  flexibilidad: 'Construimos un juego que no depende de guardias extremas — lo armás con lo que tenés.',
  coordinacion: 'Patrones simples y repetibles que entran en automático con menos repeticiones.',
  mental: 'Plan claro semana a semana: dejás de improvisar y la confianza vuelve sola.',
};

const ESTADO_HOOK: Record<string, string> = {
  estancado: 'Identificamos qué te tiene estancado y rompemos esa meseta en semanas.',
  noaplico: 'Cerramos la brecha entre lo que entrenás y lo que aplicás en lucha real.',
  improviso: 'Reemplazamos la improvisación por un plan claro semana a semana.',
  inconsistente: 'Volvés tu rendimiento consistente: lo bueno deja de ser casualidad.',
  canso: 'Trabajamos un juego que no se basa en quemar gas — economía de movimiento.',
  cuerpo: 'Adaptamos el juego a tu cuerpo de hoy — sin pelear contra él.',
};

const VISION_HOOK: Record<string, string> = {
  claridad: 'Vamos a darte un mapa de juego claro: en cada situación sabés qué hacer.',
  ritmo: 'Diseñamos un estilo donde imponés tu ritmo y dejás de reaccionar al rival.',
  estrategia: 'Te sacamos de la improvisación con un sistema repetible y estratégico.',
  solidez: 'Construimos un juego sólido en ataque y en defensa — sin huecos.',
};

/**
 * Anexa nuestro session_id como `utm_content` al link de Calendly. Calendly
 * propaga ese valor al webhook `invitee.created`, lo que nos permite asociar
 * la reserva con la fila del lead en `lead_quiz_responses`.
 */
function withSession(url: string, sessionId: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_content', sessionId);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}utm_content=${encodeURIComponent(sessionId)}`;
  }
}

function QuizResult({
  answers,
  calendlyUrl,
  sessionId,
}: {
  answers: Partial<Record<AnswerKey, string>>;
  calendlyUrl: string;
  sessionId: string;
}) {
  const fortaleza = answers.fortaleza ? FORTALEZA_LABEL[answers.fortaleza] : null;
  const limitacionHook = answers.limitacion ? LIMITACION_HOOK[answers.limitacion] : null;
  const estadoHook = answers.estado ? ESTADO_HOOK[answers.estado] : null;
  const visionHook = answers.vision ? VISION_HOOK[answers.vision] : null;

  // Después de agendar:
  //   - 'pending'  → todavía mostramos el calendly (lead no agendó)
  //   - 'checking' → Calendly emitió event_scheduled, estamos esperando
  //                  a ver si el webhook nos guardó el teléfono.
  //   - 'phone'    → no llegó teléfono desde Calendly, pedímoslo nosotros.
  //   - 'done'     → ya tenemos teléfono, mostrar gracias + scroll.
  const [postBookStep, setPostBookStep] = useState<
    'pending' | 'checking' | 'phone' | 'done'
  >('pending');

  // Calendly emite postMessage cuando el lead termina de agendar.
  useEffect(() => {
    function handler(e: MessageEvent) {
      const data = e.data as { event?: unknown } | null;
      if (!data || typeof data.event !== 'string') return;
      if (data.event === 'calendly.event_scheduled') {
        void fetch('/api/leads/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, booked: true }),
        }).catch(() => undefined);
        setPostBookStep('checking');
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sessionId]);

  // Mientras estamos en 'checking', poleamos /api/leads/check para ver si
  // el webhook de Calendly ya guardó el teléfono. Si sí, saltamos el form.
  useEffect(() => {
    if (postBookStep !== 'checking') return;
    let cancelled = false;
    const deadline = Date.now() + 6000;
    async function poll() {
      while (!cancelled && Date.now() < deadline) {
        try {
          const res = await fetch(
            `/api/leads/check?session_id=${encodeURIComponent(sessionId)}`,
          );
          if (res.ok) {
            const j = (await res.json()) as { has_phone?: boolean };
            if (j.has_phone) {
              if (!cancelled) setPostBookStep('done');
              return;
            }
          }
        } catch {
          /* keep trying */
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      if (!cancelled) setPostBookStep('phone');
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [postBookStep, sessionId]);

  if (postBookStep === 'checking') {
    return <CheckingScreen />;
  }
  if (postBookStep === 'phone') {
    return <PhoneCollect sessionId={sessionId} />;
  }
  if (postBookStep === 'done') {
    return <BookedSuccess />;
  }

  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
      <div className="flex items-center gap-2 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
        <CheckCircle2 className="h-4 w-4" />
        Evaluación lista
      </div>
      <h3 className="mt-3 text-2xl font-bold leading-tight">
        Tu juego se construye sobre tu{' '}
        {fortaleza ? <span className="text-jjl-red">{fortaleza}</span> : 'perfil'}.
      </h3>
      <ul className="mt-4 space-y-2 text-[14px] text-white/85">
        {limitacionHook && (
          <li className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-jjl-red shrink-0" />
            <span>{limitacionHook}</span>
          </li>
        )}
        {estadoHook && (
          <li className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-jjl-red shrink-0" />
            <span>{estadoHook}</span>
          </li>
        )}
        {visionHook && (
          <li className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-jjl-red shrink-0" />
            <span>{visionHook}</span>
          </li>
        )}
      </ul>

      <div className="mt-5 rounded-xl bg-black/30 border border-jjl-border p-4">
        <p className="text-[13px] text-white/90 leading-relaxed">
          <strong className="text-white">Sesión 1 a 1 para analizar tu juego</strong> y
          ver si realmente te podemos ayudar.
        </p>
      </div>

      <div className="mt-5">
        <CalendlyEmbed url={withSession(calendlyUrl, sessionId)} />
      </div>

      <p className="mt-3 text-[11px] text-jjl-muted text-center">
        45 min · Con un coach real · Solo agendamos con quienes están listos para avanzar
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantallas post-agenda: spinner mientras esperamos al webhook de Calendly
// y mensaje final cuando ya tenemos teléfono (vía Calendly o vía PhoneCollect).
// ---------------------------------------------------------------------------

function CheckingScreen() {
  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
      <div className="flex items-center gap-2 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
        <CheckCircle2 className="h-4 w-4" />
        Confirmando tu reserva
      </div>
      <h3 className="mt-3 text-xl sm:text-2xl font-bold leading-snug">
        Procesando tu agenda...
      </h3>
      <p className="mt-3 text-[14px] text-white/85 leading-relaxed">
        Un segundo mientras confirmamos tus datos.
      </p>
      <div className="mt-5 flex items-center gap-2 text-[12px] text-jjl-muted">
        <span className="h-2 w-2 rounded-full bg-jjl-red animate-pulse" />
        <span>Sincronizando con Calendly</span>
      </div>
    </div>
  );
}

function BookedSuccess() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const target =
        document.querySelector('[data-scroll-target="next"]') ||
        document.querySelector('section ~ section');
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollBy({ top: 600, behavior: 'smooth' });
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
      <div className="flex items-center gap-2 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
        <CheckCircle2 className="h-4 w-4" />
        Listo
      </div>
      <h3 className="mt-3 text-2xl font-bold leading-tight">
        Recibimos tu consulta.
      </h3>
      <p className="mt-3 text-[14px] text-white/85 leading-relaxed">
        Pronto un coach te va a contactar por WhatsApp para revisar tu caso en
        particular y tratar con vos lo que te gustaría llevarte de esta sesión.
      </p>
      <p className="mt-4 text-[12px] text-jjl-muted italic">
        Mientras tanto, conocé un poco más abajo cómo trabajamos ↓
      </p>
    </div>
  );
}

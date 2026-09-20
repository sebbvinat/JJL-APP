'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  AtSign,
  Brain,
  Briefcase,
  CheckCircle2,
  Eye,
  Flame,
  Footprints,
  Gauge,
  Hourglass,
  Phone,
  RefreshCcw,
  Sailboat,
  Sparkles,
  Trophy,
  Wind,
} from 'lucide-react';
import CalendlyEmbed from './CalendlyEmbed';
import { withSession } from '@/lib/calendly-url';
import PhoneCollect, { COUNTRIES } from './PhoneCollect';

type AnswerKey =
  | 'instagram'
  | 'telefono'
  | 'pais'
  | 'ocupacion'
  | 'fortaleza'
  | 'limitacion'
  | 'estado'
  | 'vision'
  | 'compromiso'
  | 'urgencia';

interface Option {
  value: string;
  label: string;
  Icon: typeof Activity;
  // Si el lead elige una opción con disqualifies=true, no le mostramos el
  // calendario al final — recibe un mensaje pidiendo que vuelva cuando esté
  // listo. ADEMÁS queda marcado como `disqualified=true` en el panel del
  // setter (sale del pipeline activo).
  //
  // HOY NO LO USA NINGUNA OPCIÓN. Lo tenía "solo estoy viendo", pero
  // curiosear no dice nada sobre si la persona puede comprar y le tapaba la
  // agenda. El único filtro es la pregunta de si está dispuesto a invertir,
  // que usa hidesCalendar. Se deja el mecanismo por si hace falta cortar
  // alguna respuesta más adelante.
  disqualifies?: boolean;
  // hidesCalendar=true oculta el Calendly al final del quiz (se le muestra
  // una pantalla de "te contactamos pronto") pero NO descalifica el lead.
  // El setter lo ve normal en el panel — sirve para el flujo "no quiere
  // invertir vía consultoría, vamos por low-ticket por DM".
  hidesCalendar?: boolean;
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
    }
  | {
      // WhatsApp: selector de país + número. Guarda `telefono` ("+549...") y
      // `pais` (código de marcado), igual que PhoneCollect.
      kind: 'phone';
      key: 'telefono';
      eyebrow: string;
      title: string;
      hint?: string;
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
    // Va antes que el resto para tenerlo aunque abandonen a mitad del
    // formulario o no lleguen a agendar. Si ya lo dejan acá, el pedido de
    // número que aparecía después de agendar se saltea solo (/api/leads/check).
    kind: 'phone',
    key: 'telefono',
    eyebrow: 'Tu WhatsApp',
    title: '¿A qué número de WhatsApp te podemos escribir?',
    hint: 'Para confirmarte la sesión. Solo lo usamos para esta consultoría.',
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
        // Antes descalificaba y le tapaba el Calendly. Ya no: estar
        // curioseando no dice nada de si puede comprar, y el unico filtro
        // real es la pregunta de si esta dispuesto a invertir. La respuesta
        // se sigue guardando y el Kanban la marca en rojo ("Lead frio · solo
        // curiosea"), asi que el setter conserva la señal sin perder la
        // chance de que agende.
      },
    ],
  },
  {
    kind: 'choice',
    key: 'urgencia',
    eyebrow: 'Tu disposición',
    title: 'Si vemos que realmente podemos ayudarte y que el programa encaja con lo que estás buscando, ¿estarías dispuesto a invertir para construir el juego ideal para vos?',
    hint: 'Sin compromiso todavía — solo queremos entender en qué momento estás.',
    options: [
      {
        value: 'si',
        label: 'Sí',
        Icon: CheckCircle2,
      },
      {
        value: 'no',
        label: 'No',
        Icon: Eye,
        // No descalifica — pero le saltamos el Calendly. El setter lo
        // contacta por DM con una propuesta low-ticket en 48hs.
        hidesCalendar: true,
      },
    ],
  },
];

interface EvaluationQuizProps {
  calendlyUrl: string;
}

/**
 * Usuario de Instagram que viene en el link, ej:
 *   alumno.jiujitsulatino.com/consultoria-gratuita?ig=nico.d
 *
 * ManyChat conoce el handle REAL de la persona con la que esta chateando, asi
 * que puede armar el link con el adentro. Cuando llega asi no le preguntamos
 * el Instagram: escrito a mano la gente inventa o se equivoca, y despues no
 * hay forma de encontrarla para el follow-up.
 *
 * Se aceptan tambien ?instagram= y ?handle= por si el flujo usa otro nombre.
 */
function instagramDeLaUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const crudo = q.get('ig') || q.get('instagram') || q.get('handle') || '';
  // Ojo: aca decia replace(/s+/g,'') por una barra invertida perdida, o sea
  // que borraba todas las letras 's' del usuario. Filtramos directo contra
  // los caracteres que Instagram permite, que ademas limpia cualquier basura.
  const v = crudo.trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export default function EvaluationQuiz({ calendlyUrl }: EvaluationQuizProps) {
  const [step, setStep] = useState(0); // 0..PREGUNTAS.length, last = done
  // Si el link ya trae el Instagram, ese gana y la pregunta no se muestra.
  const [igDeLink] = useState<string | null>(() => instagramDeLaUrl());
  const [answers, setAnswers] = useState<Partial<Record<AnswerKey, string>>>(
    () => (igDeLink ? { instagram: igDeLink } : {}),
  );
  const [pickedValue, setPickedValue] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // useState con lazy initializer: React permite que la función impura
  // (Date.now/Math.random) corra una sola vez al mount.
  const [sessionId] = useState<string>(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  // Cuando el handle viene en el link, esa pregunta se saca de la lista: asi
  // el contador y la barra de progreso siguen siendo honestos.
  const PREGUNTAS = useMemo(
    () => (igDeLink ? QUESTIONS.filter((q) => q.key !== 'instagram') : QUESTIONS),
    [igDeLink],
  );

  const total = PREGUNTAS.length;
  const isDone = step >= total;
  const currentQuestion = !isDone ? PREGUNTAS[step] : null;
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

  // ¿Alguna respuesta nos pide saltar la pantalla de Calendly?
  // (sin descalificar — el setter lo trabaja por DM con low ticket)
  const hidesCalendar = useMemo(() => {
    return QUESTIONS.some((q) => {
      if (q.kind !== 'choice') return false;
      const ans = answers[q.key];
      if (!ans) return false;
      const opt = q.options.find((o) => o.value === ans);
      return Boolean(opt?.hidesCalendar);
    });
  }, [answers]);

  // Persist answers when the quiz is finished. Best-effort, ignore failures.
  useEffect(() => {
    if (!isDone) return;
    const payload = {
      session_id: sessionId,
      instagram: answers.instagram,
      telefono: answers.telefono,
      pais: answers.pais,
      ocupacion: answers.ocupacion,
      fortaleza: answers.fortaleza,
      limitacion: answers.limitacion,
      estado: answers.estado,
      vision: answers.vision,
      compromiso: answers.compromiso,
      urgencia: answers.urgencia,
      disqualified: isDisqualified,
    };
    // Sólo las choice questions son obligatorias para considerar el quiz
    // "completo" — instagram y ocupacion son opcionales.
    if (
      !payload.limitacion ||
      !payload.compromiso ||
      !payload.urgencia
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
    // Meta Pixel: la PRIMER respuesta del quiz dispara StartQuiz (custom).
    // Sirve para ver dropoff entre "vio la página" y "empezó el quiz".
    // step === 0 + answers vacío = primera vez.
    if (step === 0 && Object.keys(answers).length === 0) {
      void import('@/lib/meta-pixel').then((m) =>
        m.trackStartQuiz('Quiz consultoria'),
      );
    }
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
    setAnswers(igDeLink ? { instagram: igDeLink } : {});
    setStep(0);
    setPickedValue(null);
  }

  if (isDone) {
    if (isDisqualified) {
      return <DisqualifiedScreen onReset={reset} />;
    }
    if (hidesCalendar) {
      return <NoCalendarScreen instagram={answers.instagram || null} />;
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
      ) : q.kind === 'phone' ? (
        <PhoneStep
          initialCountry={answers.pais || '54'}
          initialTelefono={answers.telefono || ''}
          onSubmit={(telefono, pais) => {
            setAnswers((prev) => ({ ...prev, telefono, pais }));
            setStep((s) => s + 1);
          }}
        />
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
// WhatsApp step: país + número. Si falta o es corto, avisa por qué no avanza.
// ---------------------------------------------------------------------------

function PhoneStep({
  initialCountry,
  initialTelefono,
  onSubmit,
}: {
  initialCountry: string;
  initialTelefono: string;
  onSubmit: (telefono: string, pais: string) => void;
}) {
  const [country, setCountry] = useState(initialCountry);
  // Al volver con "Anterior" se muestra el número sin el código del país.
  const [phone, setPhone] = useState(() =>
    initialTelefono.startsWith(`+${initialCountry}`)
      ? initialTelefono.slice(initialCountry.length + 1)
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const selected = COUNTRIES.find((c) => c.code === country);

  function commit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/[^0-9]/g, '');
    if (!digits) {
      setError('Escribí tu número de WhatsApp para continuar.');
      return;
    }
    if (digits.length < 8) {
      setError('El número parece incompleto. Revisalo (sin el código del país).');
      return;
    }
    setError(null);
    onSubmit(`+${country}${digits}`, country);
  }

  return (
    <form onSubmit={commit} className="mt-5 space-y-3" noValidate>
      <select
        aria-label="País"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="w-full bg-black/30 border border-jjl-border rounded-xl px-4 h-12 text-[16px] text-white focus:outline-none focus:border-jjl-red/60"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag}  {c.name}  +{c.code}
          </option>
        ))}
      </select>
      <div
        className={`flex items-stretch w-full bg-black/30 border rounded-xl focus-within:border-jjl-red/60 overflow-hidden ${
          error ? 'border-jjl-red/60' : 'border-jjl-border'
        }`}
      >
        <span className="flex items-center gap-1.5 px-3 sm:px-4 bg-white/[0.04] border-r border-jjl-border text-[15px] font-semibold text-white shrink-0">
          <span aria-hidden>{selected?.flag || '🌐'}</span>
          <span>+{country}</span>
        </span>
        <div className="flex-1 flex items-center min-w-0">
          <Phone className="h-4 w-4 text-jjl-muted shrink-0 ml-3" aria-hidden />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="11 5555 5555"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError(null);
            }}
            className="block w-full bg-transparent border-0 outline-0 px-3 h-12 text-[16px] text-white placeholder:text-jjl-muted/60 focus:outline-none focus:ring-0"
            aria-label="Tu número sin el código de país"
            autoFocus
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-[12px] text-jjl-red">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-jjl-muted">Sin el código del país.</p>
      )}
      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 bg-jjl-red hover:bg-jjl-red-hover text-white font-semibold rounded-xl transition-colors"
      >
        Continuar
      </button>
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
// No-calendar screen — al lead que respondió "No" a la pregunta de inversión
// no le mostramos el Calendly: el setter lo contacta por DM con una
// propuesta low-ticket en las próximas 48hs.
// ---------------------------------------------------------------------------

function NoCalendarScreen({ instagram }: { instagram: string | null }) {
  return (
    <div className="bg-jjl-gray rounded-2xl border border-jjl-red/30 p-6 sm:p-7 shadow-[0_30px_60px_-30px_rgba(220,38,38,0.35)]">
      <div className="flex items-center gap-2 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
        <Sparkles className="h-4 w-4" />
        Recibimos tu información
      </div>
      <h3 className="mt-3 text-2xl font-bold leading-tight">
        Gracias por completar el formulario.
      </h3>
      <p className="mt-3 text-[14px] text-white/85 leading-relaxed">
        Vamos a revisar tu caso y te escribimos por <strong>DM a tu Instagram</strong>
        {instagram ? <> (<span className="text-jjl-red">@{instagram}</span>)</> : null} en
        las próximas <strong>24 a 48 horas</strong> con una propuesta personalizada,
        pensada para vos.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result screen — personalized hook + Calendly embed → phone collect.
// ---------------------------------------------------------------------------


const LIMITACION_HOOK: Record<string, string> = {
  cardio: 'Trabajamos un juego que no se basa en quemar gas — sobrevivís lucha tras lucha.',
  movilidad: 'Armamos un juego que funciona desde donde ya estás parado, sin depender de moverte más rápido que el otro.',
  flexibilidad: 'Construimos un juego que no depende de guardias extremas — lo armás con lo que tenés.',
  coordinacion: 'Patrones simples y repetibles que entran en automático con menos repeticiones.',
  mental: 'Plan claro semana a semana: dejás de improvisar y la confianza vuelve sola.',
};



function QuizResult({
  answers,
  calendlyUrl,
  sessionId,
}: {
  answers: Partial<Record<AnswerKey, string>>;
  calendlyUrl: string;
  sessionId: string;
}) {
  const limitacionHook = answers.limitacion ? LIMITACION_HOOK[answers.limitacion] : null;

  // Después de agendar:
  //   - 'pending'  → todavía mostramos el calendly (lead no agendó)
  //   - 'checking' → Calendly emitió event_scheduled, estamos esperando
  //                  a ver si el webhook nos guardó el teléfono.
  //   - 'phone'    → no llegó teléfono desde Calendly, pedímoslo nosotros.
  //   - 'done'     → ya tenemos teléfono, mostrar gracias + scroll.
  const [postBookStep, setPostBookStep] = useState<
    'pending' | 'checking' | 'phone' | 'done'
  >('pending');

  // Meta Pixel: el lead completó el FORMULARIO/quiz y se le mostró el
  // resultado + Calendly. Este es nuestro evento Lead — sirve para
  // optimizar campañas hacia "completaron el quiz", que es señal fuerte
  // de interés. Mucho más amplio que esperar a que agenden.
  // Una sola vez al montar QuizResult (no se redispara en re-renders).
  useEffect(() => {
    void import('@/lib/meta-pixel').then((m) =>
      m.trackLead({ content_name: 'Quiz consultoria completado', value: 900, currency: 'USD' }),
    );
  }, []);

  // Tracker de "casi-agendó": Calendly emite `date_and_time_selected` cuando
  // el lead ya eligió día/hora — está a un click de confirmar. Si se va
  // antes del `event_scheduled`, le avisamos al setter con el contexto +
  // un link wa.me listo para escribirle a mano.
  const nearMissRef = useRef(false);
  const bookedRef = useRef(false);

  // Calendly emite postMessage cuando el lead termina de agendar.
  useEffect(() => {
    function handler(e: MessageEvent) {
      const data = e.data as { event?: unknown } | null;
      if (!data || typeof data.event !== 'string') return;
      if (data.event === 'calendly.date_and_time_selected') {
        nearMissRef.current = true;
      }
      if (data.event === 'calendly.event_scheduled') {
        bookedRef.current = true;
        nearMissRef.current = false; // ya no es near-miss, agendó
        // Meta Pixel: el lead AGENDÓ la llamada. Disparamos `Schedule`
        // (evento estándar Meta) — no `Lead` porque ese se disparó al
        // completar el quiz. Schedule es el evento BOFU más calificado.
        void import('@/lib/meta-pixel').then((m) =>
          m.trackSchedule({ content_name: 'Agenda llamada JJL', value: 900, currency: 'USD' }),
        );
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

  // Dos disparos posibles al backend (idempotentes — solo el primero gana):
  //   - kind='slot' : eligió día/hora y se va sin confirmar (beacon)
  //   - kind='quiz' : pasan 60s desde que vio el QuizResult sin agendar
  // El segundo es el que el dueño pidió: "que el WhatsApp salga al toque
  // si terminó el quiz y no agendó". 60s de gracia para que un lead
  // decidido alcance a elegir.
  const dispatchedRef = useRef(false);

  // Timer de 60s desde que se monta este componente (= lead acaba de
  // terminar el quiz). Si llega al deadline sin haber agendado, fire.
  useEffect(() => {
    if (dispatchedRef.current) return;
    const t = setTimeout(() => {
      if (bookedRef.current || dispatchedRef.current) return;
      dispatchedRef.current = true;
      void fetch('/api/leads/near-miss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, kind: 'quiz' }),
      }).catch(() => undefined);
    }, 60_000);
    return () => clearTimeout(t);
  }, [sessionId]);

  // Beacon al cerrar la pestaña / cambiar de tab. Si el lead se va antes
  // de los 60s y eligió slot, kind='slot' (más caliente). Si se va y NO
  // eligió slot, kind='quiz' igual — porque también es "completó quiz
  // sin agendar", solo que más rápido.
  useEffect(() => {
    function maybeBeacon() {
      if (dispatchedRef.current || bookedRef.current) return;
      dispatchedRef.current = true;
      try {
        const kind = nearMissRef.current ? 'slot' : 'quiz';
        const payload = JSON.stringify({ session_id: sessionId, kind });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'text/plain' });
          navigator.sendBeacon('/api/leads/near-miss', blob);
        } else {
          void fetch('/api/leads/near-miss', {
            method: 'POST',
            body: payload,
            keepalive: true,
          });
        }
      } catch {
        /* no-op */
      }
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dispatchedRef.current || bookedRef.current) return;
      maybeBeacon();
      // Confirm nativo SOLO si estuvo cerca de agendar (eligió slot). Si
      // ni miró el Calendly, no jodemos con el prompt — igual le va a
      // llegar el WhatsApp.
      if (nearMissRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') maybeBeacon();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
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
        Ya sabemos <span className="text-jjl-red">por dónde empezar</span> con vos.
      </h3>
      {limitacionHook && (
        <p className="mt-4 text-[15px] leading-relaxed text-white/85">{limitacionHook}</p>
      )}

      <div className="mt-5 rounded-xl bg-black/30 border border-jjl-border p-4">
        <p className="text-[13px] text-white/90 leading-relaxed">
          <strong className="text-white">Sesión 1 a 1 para analizar tu juego ideal</strong> de
          acuerdo a tu cuerpo y tu edad, y cómo podrías alcanzar tus objetivos en el tatami.
        </p>
      </div>

      <div className="mt-5">
        <CalendlyEmbed
          url={withSession(calendlyUrl, sessionId, answers.instagram)}
          sessionId={sessionId}
        />
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

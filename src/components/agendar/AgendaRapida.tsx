'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import CalendlyEmbed from '@/components/consultoria/CalendlyEmbed';
import { withSession } from '@/lib/calendly-url';

/**
 * La agenda rápida: tres preguntas y el calendario.
 *
 * Existe aparte de /consultoria-gratuita a propósito. Esa página es una
 * landing con testimonios, garantía, preguntas frecuentes y método — está
 * hecha para alguien que llega frío desde un anuncio y hay que convencerlo.
 *
 * Acá la persona ya viene del quiz: ya se enganchó, ya vio su ficha y ya nos
 * dejó el contacto. Meterle todo ese texto otra vez la haría abandonar. Solo
 * quedan las tres preguntas que necesitamos para saber si le mostramos el
 * calendario.
 *
 * Escribe en la misma tabla que el formulario largo (`lead_quiz_responses`),
 * así los dos caminos caen en el mismo embudo, los mismos follow-ups y las
 * mismas métricas.
 */

interface Opcion {
  value: string;
  label: string;
}

interface Pregunta {
  key: 'compromiso' | 'ocupacion' | 'urgencia';
  titulo: string;
  bajada?: string;
  opciones: Opcion[];
}

// Los `value` TIENEN que ser los mismos que usa el formulario largo
// (EvaluationQuiz.tsx): las notificaciones traducen el valor con
// COMPROMISO_LABEL y un valor distinto sale crudo. Aca estuvo 'enserio' en vez
// de 'serio' y la notificacion al setter decia literalmente "compromiso: enserio".
const PREGUNTAS: Pregunta[] = [
  {
    key: 'compromiso',
    titulo: '¿Qué tan comprometido estás con mejorar tu juego hoy?',
    opciones: [
      { value: 'serio', label: 'Quiero ordenar mi juego en serio y adaptarlo a mi realidad' },
      { value: 'moderado', label: 'Quiero mejorar, pero sin cambiar demasiado lo que vengo haciendo' },
      { value: 'viendo', label: 'Solo estoy viendo' },
    ],
  },
  {
    key: 'ocupacion',
    titulo: '¿A qué te dedicás?',
    bajada: 'Para saber cuánto tiempo y energía tenés para entrenar.',
    opciones: [
      { value: 'estable', label: 'Trabajo estable o negocio propio' },
      { value: 'inestable', label: 'Trabajo inestable' },
      { value: 'jubilado', label: 'Jubilado' },
    ],
  },
  {
    key: 'urgencia',
    titulo: 'Si el programa encaja con lo que buscás, ¿estarías dispuesto a invertir en tu juego?',
    bajada: 'Sin compromiso todavía — solo para saber en qué momento estás.',
    opciones: [
      { value: 'si', label: 'Sí' },
      { value: 'no', label: 'Todavía no' },
    ],
  },
];

/** Usuario de Instagram que viene en el link desde el quiz. */
function instagramDeLaUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const crudo = q.get('ig') || q.get('instagram') || q.get('handle') || '';
  const v = crudo.trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

type Estado = 'preguntas' | 'enviando' | 'calendario' | 'sin-calendario';

export default function AgendaRapida({ calendlyUrl }: { calendlyUrl: string }) {
  // Misma sesión que el quiz del luchador: si la persona viene de ahí, las dos
  // filas quedan atadas por el mismo id y se puede seguir el recorrido entero.
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return crypto.randomUUID();
    const guardado = window.localStorage.getItem('jjl_match_session');
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    window.localStorage.setItem('jjl_match_session', nuevo);
    return nuevo;
  });
  const [instagram] = useState<string | null>(() => instagramDeLaUrl());

  const [estado, setEstado] = useState<Estado>('preguntas');
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});

  const pregunta = PREGUNTAS[paso];
  const progreso = useMemo(
    () => Math.round(((paso + 1) / PREGUNTAS.length) * 100),
    [paso],
  );

  function elegir(value: string) {
    const nuevas = { ...respuestas, [pregunta.key]: value };
    setRespuestas(nuevas);
    setTimeout(() => {
      if (paso < PREGUNTAS.length - 1) {
        setPaso((p) => p + 1);
        return;
      }
      enviar(nuevas);
    }, 220);
  }

  async function enviar(finales: Record<string, string>) {
    setEstado('enviando');
    try {
      await fetch('/api/leads/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, instagram, ...finales }),
      });
    } catch {
      // Si falla el guardado igual la dejamos agendar: perder la agenda por un
      // error de red es mucho peor que perder la fila.
    }
    setEstado(finales.urgencia === 'si' ? 'calendario' : 'sin-calendario');
  }

  // Calendly avisa por postMessage cuando termina de agendar.
  useEffect(() => {
    if (estado !== 'calendario') return;
    function handler(e: MessageEvent) {
      const data = e.data as { event?: unknown } | null;
      if (!data || typeof data.event !== 'string') return;
      if (data.event !== 'calendly.event_scheduled') return;
      void import('@/lib/meta-pixel').then((m) =>
        m.trackSchedule({ content_name: 'Agenda llamada JJL', value: 900, currency: 'USD' }),
      );
      void fetch('/api/leads/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, booked: true }),
      }).catch(() => undefined);
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [estado, sessionId]);

  // ── Enviando ───────────────────────────────────────────────────────────
  if (estado === 'enviando') {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-jjl-red" strokeWidth={1.5} />
        <p className="mt-6 text-[14px] text-white/70">Buscando horarios disponibles…</p>
      </div>
    );
  }

  // ── No califica: no ve el calendario, lo trabaja el setter por DM ──────
  if (estado === 'sin-calendario') {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-jjl-red">
          Recibimos tu información
        </p>
        <h2 className="mt-4 text-[26px] font-black leading-tight tracking-[-0.02em] text-white">
          Gracias por contestar.
        </h2>
        <p className="mt-4 text-[14.5px] leading-relaxed text-white/70">
          Vamos a revisar tu caso y te escribimos
          {instagram ? ` por DM a @${instagram}` : ' por Instagram'} en las próximas
          24 a 48 horas con una recomendación concreta para tu juego.
        </p>
      </div>
    );
  }

  // ── El calendario ──────────────────────────────────────────────────────
  if (estado === 'calendario') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-jjl-red">
            Último paso
          </p>
          <h2 className="mt-3 text-[26px] font-black leading-tight tracking-[-0.02em] text-white">
            Elegí el día y la hora
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/65">
            Sesión 1 a 1 para analizar tu juego ideal de acuerdo a tu cuerpo y tu edad,
            y cómo podrías alcanzar tus objetivos en el tatami.
          </p>
        </div>
        <div className="mt-7">
          <CalendlyEmbed url={withSession(calendlyUrl, sessionId, instagram)} sessionId={sessionId} />
        </div>
      </div>
    );
  }

  // ── Las tres preguntas ─────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-6">
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
          disabled={paso === 0}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-jjl-muted transition-colors hover:bg-white/5 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-jjl-red transition-all duration-500 ease-out"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-jjl-muted">
          {paso + 1}
          <span className="text-white/25">/{PREGUNTAS.length}</span>
        </span>
      </div>

      <h2 className="text-[24px] font-black leading-[1.18] tracking-[-0.02em] text-white">
        {pregunta.titulo}
      </h2>
      {pregunta.bajada && (
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/50">{pregunta.bajada}</p>
      )}

      <div className="mt-7 space-y-2.5">
        {pregunta.opciones.map((o) => {
          const elegida = respuestas[pregunta.key] === o.value;
          return (
            <button
              key={o.value}
              onClick={() => elegir(o.value)}
              className={`group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left transition-all duration-150 ${
                elegida
                  ? 'border-jjl-red bg-jjl-red/15 text-white'
                  : 'border-jjl-border bg-white/[0.03] text-white/90 hover:border-jjl-border-strong hover:bg-white/[0.06]'
              }`}
              style={{ minHeight: '58px' }}
            >
              <span
                className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 transition-colors ${
                  elegida ? 'border-jjl-red bg-jjl-red' : 'border-white/20 group-hover:border-white/35'
                }`}
              />
              <span className="text-[15px] font-medium leading-snug">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Zap, Shield, Target, MessageCircle, Download, Loader2 } from 'lucide-react';
import type { Arquetipo, BrechaBloque } from '@/lib/match-arquetipos';
import { trackLead } from '@/lib/meta-pixel';
import { renderPoster } from '@/lib/match-poster';

interface Props {
  sessionId: string;
  /** Lo cargo antes de empezar el test; se usa para saludar en el WhatsApp. */
  nombre: string;
  arquetipo: Arquetipo;
  matchPct: number;
  /** "Lo que te separa" — lo calcula la API cruzando dolor + frecuencia + antigüedad. */
  brecha?: BrechaBloque[];
}

export default function MatchResult({ sessionId, nombre, arquetipo, matchPct, brecha = [] }: Props) {
  const [generando, setGenerando] = useState(false);
  const [descargado, setDescargado] = useState(false);

  // Meta Pixel: el lead completó el quiz viral — Lead event para campañas
  // top-of-funnel. Distinto del Lead de Calendly (que vale +$): este es
  // más tibio pero sirve para lookalikes y retargeting.
  useEffect(() => {
    trackLead({ content_name: `Match quiz: ${arquetipo.nombre}` });
  }, [arquetipo.nombre]);

  /** Marca que apretó WhatsApp o compartir. Best-effort: si falla, no bloquea. */
  function marcar(action: 'dm' | 'shared') {
    try {
      fetch('/api/leads/match-quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {}
  }

  // WhatsApp en vez de DM de Instagram: el DM depende de estar logueado en la
  // app y cae en "solicitudes de mensaje" si no seguís la cuenta. WhatsApp abre
  // siempre y deja el número, que es lo que el setter necesita para seguirlo.
  const WHATSAPP_JJL = '5491166518801';
  const waText =
    (nombre.trim() ? `Hola! Soy ${nombre.trim()}. ` : 'Hola! ') +
    `Hice el test "¿A qué luchador te parecés?" y me dio ${arquetipo.nombre} (${matchPct}% match).` +
    (brecha.length ? ` Me quedé pensando en esto: "${brecha[0].titulo}".` : '') +
    ` Quiero saber qué me separa de él.`;
  const waUrl = `https://wa.me/${WHATSAPP_JJL}?text=${encodeURIComponent(waText)}`;

  function abrirWhatsApp() {
    // Manda contacto + accion en la misma llamada: si la persona escribio el
    // nombre y no salio del campo, el blur nunca disparo y se perderia.
    marcar('dm');
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Genera la ficha como PNG de 1080x1920 y la comparte.
   *
   * Antes esto copiaba un texto al portapapeles, que para Instagram no sirve
   * de nada: a una story se sube una imagen. Si el celular soporta compartir
   * archivos usamos la hoja nativa (ahi aparece Instagram); si no, se descarga
   * y la sube a mano.
   */
  async function compartirFicha() {
    if (generando) return;
    setGenerando(true);
    marcar('shared');
    try {
      const blob = await renderPoster({
        nombre: arquetipo.nombre,
        apodo: arquetipo.apodo,
        matchPct,
        foto: arquetipo.foto,
        fortaleza: arquetipo.fortaleza,
        mejorGuardia: arquetipo.mejorGuardia,
        mejorPasaje: arquetipo.mejorPasaje,
      });
      if (!blob) throw new Error('sin blob');

      const archivo = new File([blob], 'mi-luchador-jjl.png', { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };

      if (nav.canShare?.({ files: [archivo] }) && nav.share) {
        try {
          await nav.share({
            files: [archivo],
            text: `Me parezco a ${arquetipo.nombre} (${matchPct}% match). Hacé el test: alumno.jiujitsulatino.com/que-luchador-sos`,
          });
          setGenerando(false);
          return;
        } catch {
          // Cancelo, o el navegador no dejo compartir: cae a descargar.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mi-luchador-jjl.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDescargado(true);
    } catch {
      // Ultimo recurso: el texto, como antes.
      try {
        await navigator.clipboard.writeText(
          `Me parezco a ${arquetipo.nombre} (${matchPct}% match). Hacé el test:\nhttps://alumno.jiujitsulatino.com/que-luchador-sos`,
        );
        setDescargado(true);
      } catch {}
    }
    setGenerando(false);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <Poster arquetipo={arquetipo} matchPct={matchPct} />

      {/* ── LO QUE TE SEPARA ──────────────────────────────────────────────
          La mitad que faltaba. Sin esto el resultado es un halago: el lead
          sale contento y no tiene ningún motivo para escribir. */}
      {brecha.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-3xl border border-jjl-border bg-jjl-gray/60">
          <div className="border-b border-jjl-border/70 px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-jjl-red">
              Lo que te separa de él
            </p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {brecha.map((b, i) => (
              <div key={i} className="flex gap-4 px-6 py-5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-jjl-red/40 bg-jjl-red/15 text-[13px] font-black tabular-nums text-jjl-red">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[14.5px] font-bold leading-snug text-white">{b.titulo}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{b.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA — el motivo de escribir está arriba, no es curiosidad suelta */}
      <div className="mt-5 rounded-3xl border border-jjl-red/40 bg-gradient-to-b from-jjl-red/[0.14] to-jjl-red/[0.04] p-6">
        <p className="text-[15px] font-bold leading-snug text-white">
          Guido te dice {brecha.length > 1 ? `cuál de las ${brecha.length} atacar primero` : 'por dónde empezar'}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
          Mandale tu ficha por WhatsApp. Te responde con una cosa concreta para tu próxima semana.
        </p>
        <button
          onClick={abrirWhatsApp}
          className="mt-5 inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-jjl-red px-5 text-[15px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(220,38,38,0.9)] transition-colors hover:bg-jjl-red-hover"
          style={{ minHeight: '54px' }}
        >
          <MessageCircle className="h-5 w-5" />
          Mandar mi ficha por WhatsApp
        </button>
      </div>

      <button
        onClick={compartirFicha}
        disabled={generando}
        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-jjl-border bg-white/[0.04] px-5 text-[14px] font-semibold text-white transition-colors hover:border-jjl-border-strong hover:bg-white/[0.08] disabled:opacity-60"
        style={{ minHeight: '52px' }}
      >
        {generando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Armando tu ficha…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            {descargado ? '¡Listo! Subila a tu story' : 'Bajar mi ficha para la story'}
          </>
        )}
      </button>

      {/* La atribucion es obligatoria para las fotos CC BY / BY-SA. Sale solo
          cuando el arquetipo que toco la necesita. */}
      {arquetipo.credito && (
        <p className="mt-6 text-center text-[10px] text-white/25">{arquetipo.credito}</p>
      )}

      <p className="mt-6 text-center text-[11px] text-white/35">
        Jiu Jitsu Latino · Programa de 6 meses
      </p>
    </div>
  );
}

/**
 * La ficha, pensada como afiche y no como tarjeta de datos.
 *
 * Es lo que la persona ve primero y lo que va a fotografiar, asi que carga
 * todo el peso visual: retrato grande, el match como anillo alrededor y el
 * nombre en grande. La misma composicion se dibuja en `match-poster.ts` para
 * el PNG que se comparte, para que lo que baja sea lo que vio.
 */
function Poster({ arquetipo, matchPct }: { arquetipo: Arquetipo; matchPct: number }) {
  // El anillo arranca en cero y se llena al entrar: el numero se entiende
  // antes de leerlo.
  const [dibujado, setDibujado] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const DURACION = 1100;

    // Sin animacion si la pestaña esta en segundo plano (ahi requestAnimationFrame
    // no corre y el numero quedaria clavado en 0 al volver) o si la persona
    // pidio menos movimiento en el sistema.
    const quieto =
      document.hidden ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (quieto) {
      setDibujado(true);
      setPct(matchPct);
      return;
    }

    const t = setTimeout(() => setDibujado(true), 80);
    const arranque = performance.now();
    let raf = 0;
    const tick = (ahora: number) => {
      const avance = Math.min(1, (ahora - arranque) / DURACION);
      // easeOutCubic: arranca rapido y frena, se siente mas vivo que lineal.
      setPct(Math.round(matchPct * (1 - Math.pow(1 - avance, 3))));
      if (avance < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Red de seguridad: si la persona se va de la pestaña en el medio, los
    // frames se cortan y el numero se queda a mitad de camino. Esto garantiza
    // el valor final pase lo que pase.
    const remate = setTimeout(() => setPct(matchPct), DURACION + 400);

    return () => {
      clearTimeout(t);
      clearTimeout(remate);
      cancelAnimationFrame(raf);
    };
  }, [matchPct]);

  const R = 86;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-jjl-red/25 bg-[#050505]">
      {/* Resplandor detrás del retrato */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(220,38,38,0.30) 0%, rgba(160,20,20,0.10) 42%, rgba(0,0,0,0) 72%)',
        }}
      />
      {/* Diagonales: textura de afiche, casi invisibles pero se notan si faltan */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 22px)',
        }}
      />

      <div className="relative px-6 pb-7 pt-7">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.32em] text-jjl-red">
          Jiu Jitsu Latino
        </p>
        <p className="mt-1.5 text-center text-[9.5px] font-semibold uppercase tracking-[0.24em] text-white/40">
          Así juega tu jiu-jitsu
        </p>

        {/* Retrato + anillo de match */}
        <div className="relative mx-auto mt-6 h-[200px] w-[200px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
            <defs>
              <linearGradient id="arcoMatch" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
            </defs>
            <circle
              cx="100" cy="100" r={R} fill="none"
              stroke="url(#arcoMatch)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dibujado ? CIRC * (1 - matchPct / 100) : CIRC}
              style={{
                transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
                filter: 'drop-shadow(0 0 7px rgba(220,38,38,0.75))',
              }}
            />
          </svg>
          <div className="absolute inset-[22px] overflow-hidden rounded-full bg-jjl-red/10">
            <Retrato nombre={arquetipo.nombre} foto={arquetipo.foto} />
          </div>
        </div>

        {/* Chapita del porcentaje, montada sobre el anillo */}
        <div className="-mt-4 flex justify-center">
          <div className="rounded-full border-2 border-jjl-red bg-[#050505] px-4 py-1.5">
            <span className="text-[15px] font-black tabular-nums text-white">{pct}% MATCH</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
          Te parecés a
        </p>
        <h1 className="mt-1.5 text-center text-[34px] font-black leading-[1.05] tracking-[-0.03em] text-white">
          {arquetipo.nombre}
        </h1>
        <p className="mt-1.5 text-center text-[14px] font-semibold text-jjl-red">
          {arquetipo.apodo}
        </p>

        <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
          <Dato icon={Zap} label="Fortaleza" value={arquetipo.fortaleza} />
          <Dato icon={Shield} label="Mejor guardia" value={arquetipo.mejorGuardia} />
          <Dato icon={Target} label="Mejor pasaje" value={arquetipo.mejorPasaje} />
        </div>
      </div>
    </div>
  );
}

/**
 * Retrato del luchador. Si todavía no cargamos su foto en /public/arquetipos/,
 * cae a las iniciales en un círculo rojo — la ficha nunca queda con un cuadro
 * roto.
 */
function Retrato({ nombre, foto }: { nombre: string; foto?: string }) {
  const [falló, setFalló] = useState(false);
  const iniciales = nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  if (!foto || falló) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-[38px] font-black tracking-tight text-jjl-red">{iniciales}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto}
      alt={nombre}
      width={156}
      height={156}
      className="h-full w-full object-cover"
      onError={() => setFalló(true)}
    />
  );
}

function Dato({
  icon: Icon, label, value,
}: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-jjl-red">
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {label}
      </div>
      <p className="text-[14.5px] font-medium leading-snug text-white">{value}</p>
    </div>
  );
}

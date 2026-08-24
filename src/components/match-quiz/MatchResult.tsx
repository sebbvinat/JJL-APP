'use client';

import { useState, useEffect } from 'react';
import { Zap, Shield, Target, MessageCircle, Share2 } from 'lucide-react';
import type { Arquetipo, BrechaBloque } from '@/lib/match-arquetipos';
import { trackLead } from '@/lib/meta-pixel';

interface Props {
  sessionId: string;
  arquetipo: Arquetipo;
  matchPct: number;
  /** "Lo que te separa" — lo calcula la API cruzando dolor + frecuencia + antigüedad. */
  brecha?: BrechaBloque[];
}

export default function MatchResult({ sessionId, arquetipo, matchPct, brecha = [] }: Props) {
  const [copied, setCopied] = useState(false);

  // Meta Pixel: el lead completó el quiz viral — Lead event para campañas
  // top-of-funnel. Distinto del Lead de Calendly (que vale +$): este es
  // más tibio pero sirve para lookalikes y retargeting.
  useEffect(() => {
    trackLead({ content_name: `Match quiz: ${arquetipo.nombre}` });
  }, [arquetipo.nombre]);

  // WhatsApp en vez de DM de Instagram: el DM depende de estar logueado en la
  // app y cae en "solicitudes de mensaje" si no seguís la cuenta. WhatsApp abre
  // siempre y deja el número, que es lo que el setter necesita para seguirlo.
  const WHATSAPP_JJL = '5491166518801';
  const waText =
    `Hola! Hice el test "¿A qué luchador te parecés?" y me dio ${arquetipo.nombre} (${matchPct}% match).` +
    (brecha.length ? ` Me quedé pensando en esto: "${brecha[0].titulo}".` : '') +
    ` Quiero saber qué me separa de él.`;
  const waUrl = `https://wa.me/${WHATSAPP_JJL}?text=${encodeURIComponent(waText)}`;

  function trackAndOpen(action: 'shared' | 'dm', url: string) {
    // Tracking best-effort. Si falla, no bloquea la apertura del link.
    try {
      fetch('/api/leads/match-quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {}
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function shareResult() {
    const shareText = `Me parezco a ${arquetipo.nombre} (${matchPct}% match). Hacé el test vos también:\nhttps://alumno.jiujitsulatino.com/que-luchador-sos`;
    // Native share API en mobile (iOS y Android)
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: 'Mi luchador',
          text: shareText,
        });
        try {
          fetch('/api/leads/match-quiz', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, action: 'shared' }),
          }).catch(() => undefined);
        } catch {}
        return;
      } catch {
        // Usuario canceló — fallback a copiar
      }
    }
    // Desktop fallback: copiar al clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      {/* Header pequeño con celebración */}
      <div className="text-center mb-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-bold">
          Tu resultado
        </p>
      </div>

      {/* La ficha tipo card */}
      <div
        className="rounded-2xl p-6 text-white border border-jjl-red/30"
        style={{ background: 'linear-gradient(155deg, #1a0a0a 0%, #0a0a0a 55%, #110505 100%)' }}
      >
        {/* Foto + nombre. La cara es lo que hace que el resultado se comparta:
            "me dio Gordon" con la cara al lado se entiende de un vistazo. */}
        <div className="flex items-center gap-4">
          <FotoArquetipo nombre={arquetipo.nombre} foto={arquetipo.foto} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-bold">
              Te parecés a
            </p>
            <h1 className="text-[26px] font-black tracking-tight leading-none mt-1">
              {arquetipo.nombre}
            </h1>
            <p className="text-[13px] text-jjl-red font-semibold mt-1.5">
              {arquetipo.apodo}
            </p>
          </div>
        </div>

        {/* Match % grande */}
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-[56px] font-black leading-none tabular-nums">{matchPct}</span>
          <span className="text-[16px] text-white/60 font-semibold">% match</span>
        </div>

        {/* Stats */}
        <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
          <Stat icon={Zap} label="Fortaleza" value={arquetipo.fortaleza} />
          <Stat icon={Shield} label="Mejor guardia" value={arquetipo.mejorGuardia} />
          <Stat icon={Target} label="Mejor pasaje" value={arquetipo.mejorPasaje} />
        </div>

      </div>

      {/* ── LO QUE TE SEPARA ──────────────────────────────────────────────
          La mitad que faltaba. Sin esto el resultado es un halago: el lead
          sale contento y no tiene ningún motivo para escribir. */}
      {brecha.length > 0 && (
        <div className="mt-4 rounded-2xl border border-jjl-border bg-white/[0.02] p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-jjl-red font-bold">
            Lo que te separa de él
          </p>
          <div className="mt-5 space-y-5">
            {brecha.map((b, i) => (
              <div key={i} className="flex gap-3.5">
                <span className="shrink-0 h-7 w-7 rounded-lg bg-jjl-red/15 border border-jjl-red/40 text-jjl-red text-[13px] font-black flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[14px] font-bold text-white leading-snug">{b.titulo}</p>
                  <p className="mt-1.5 text-[13.5px] text-white/70 leading-relaxed">{b.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA — ahora el motivo de escribir está arriba, no es curiosidad suelta */}
      <div className="mt-4 p-4 rounded-xl border border-jjl-red/40 bg-jjl-red/[0.08]">
        <p className="text-[14px] font-bold leading-snug text-white">
          Guido te dice {brecha.length > 1 ? `cuál de las ${brecha.length} atacar primero` : 'por dónde empezar'}
        </p>
        <p className="text-[12px] text-white/70 mt-1.5 leading-relaxed">
          Mandale tu ficha por WhatsApp. Te responde con una cosa concreta para tu próxima semana.
        </p>
      </div>

      <button
        onClick={() => trackAndOpen('dm', waUrl)}
        className="mt-3 w-full h-13 px-5 bg-jjl-red hover:bg-jjl-red-hover text-white text-[15px] font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2.5"
        style={{ minHeight: '52px' }}
      >
        <MessageCircle className="h-5 w-5" />
        Mandar mi ficha por WhatsApp
      </button>

      {/* Compartir */}
      <button
        onClick={shareResult}
        className="mt-5 w-full h-12 px-5 bg-white/[0.04] hover:bg-white/[0.08] border border-jjl-border hover:border-jjl-border-strong text-white text-[14px] font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2"
      >
        <Share2 className="h-4 w-4" />
        {copied ? '¡Copiado! Pegalo en tu story' : 'Compartir mi resultado'}
      </button>

      <p className="mt-6 text-center text-[11px] text-white/40">
        Jiu Jitsu Latino · Programa de 6 meses
      </p>
    </div>
  );
}

/**
 * Avatar circular del luchador. Si todavía no cargamos su foto en
 * /public/arquetipos/, cae a las iniciales en un círculo rojo — la ficha
 * nunca queda con un cuadro roto.
 */
function FotoArquetipo({ nombre, foto }: { nombre: string; foto?: string }) {
  const [falló, setFalló] = useState(false);
  const iniciales = nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const aro =
    'h-[84px] w-[84px] shrink-0 rounded-full border-2 border-jjl-red ' +
    'shadow-[0_0_28px_-4px_rgba(220,38,38,0.75)] overflow-hidden';

  if (!foto || falló) {
    return (
      <div className={`${aro} bg-jjl-red/15 flex items-center justify-center`}>
        <span className="text-[26px] font-black text-jjl-red tracking-tight">{iniciales}</span>
      </div>
    );
  }
  return (
    <div className={aro}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto}
        alt={nombre}
        width={84}
        height={84}
        className="h-full w-full object-cover"
        onError={() => setFalló(true)}
      />
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-jjl-red font-bold uppercase mb-1">
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {label}
      </div>
      <p className="text-[14px] text-white leading-snug">{value}</p>
    </div>
  );
}

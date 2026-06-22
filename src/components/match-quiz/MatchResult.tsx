'use client';

import { useState, useEffect } from 'react';
import { Zap, Shield, Target, MessageCircle, Share2 } from 'lucide-react';
import type { Arquetipo } from '@/lib/match-arquetipos';
import { trackLead } from '@/lib/meta-pixel';

interface Props {
  sessionId: string;
  arquetipo: Arquetipo;
  matchPct: number;
}

export default function MatchResult({ sessionId, arquetipo, matchPct }: Props) {
  const [copied, setCopied] = useState(false);

  // Meta Pixel: el lead completó el quiz viral — Lead event para campañas
  // top-of-funnel. Distinto del Lead de Calendly (que vale +$): este es
  // más tibio pero sirve para lookalikes y retargeting.
  useEffect(() => {
    trackLead({ content_name: `Match quiz: ${arquetipo.nombre}` });
  }, [arquetipo.nombre]);

  // Mensaje pre-armado para el DM. El lead llega al chat de @jjl.oficial
  // ya con contexto, sin tener que pensar qué escribir.
  const dmText = `Hola! Hice el test y me dio que me parezco a ${arquetipo.nombre}. Quiero saber qué me separa de él.`;
  const igMessageUrl = `https://ig.me/m/jjl.oficial?text=${encodeURIComponent(dmText)}`;
  // Fallback si ig.me no abre la conversación directa
  const igProfileUrl = 'https://instagram.com/jjl.oficial';

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
        {/* Eyebrow */}
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-bold mb-1">
          Te parecés a
        </p>
        {/* Nombre + apodo */}
        <h1 className="text-[28px] font-black tracking-tight leading-none mt-1">
          {arquetipo.nombre}
        </h1>
        <p className="text-[13px] text-jjl-red font-semibold mt-1.5">
          {arquetipo.apodo}
        </p>

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

        {/* CTA — el anzuelo de curiosidad */}
        <div className="mt-6 p-4 rounded-xl border border-jjl-red/40 bg-jjl-red/[0.08]">
          <p className="text-[14px] font-bold leading-snug">
            Ignacio sabe qué te separa de un {arquetipo.nombre}
          </p>
          <p className="text-[12px] text-white/70 mt-1.5 leading-relaxed">
            Mandale tu ficha por DM — tiene 1 cosa específica para vos.
          </p>
        </div>

        {/* Botón principal */}
        <button
          onClick={() => trackAndOpen('dm', igMessageUrl)}
          className="mt-3 w-full h-13 px-5 bg-jjl-red hover:bg-jjl-red-hover text-white text-[15px] font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2.5"
          style={{ minHeight: '52px' }}
        >
          <MessageCircle className="h-5 w-5" />
          Abrir DM con @jjl.oficial
        </button>

        {/* Fallback link al perfil */}
        <button
          onClick={() => trackAndOpen('dm', igProfileUrl)}
          className="mt-2 w-full text-[12px] text-white/50 hover:text-white/80 underline underline-offset-2"
        >
          ¿No se abrió? Abrir el perfil
        </button>
      </div>

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

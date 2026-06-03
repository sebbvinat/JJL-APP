'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, MessageSquare, Calendar, Trophy, DollarSign, AlertTriangle, Bell } from 'lucide-react';

interface Props {
  onDismiss: () => void;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

/**
 * Modal de bienvenida — se muestra una sola vez por setter, la primera
 * vez que entra a /admin/agendas. Cubre las 4 cosas clave que tiene que
 * saber para hacer el laburo: columnas, colores, descarte y comisión.
 */
export default function SetterGuide({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const steps: Step[] = [
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: 'Bienvenido, este es tu panel',
      body: (
        <>
          <p className="text-sm text-jjl-muted leading-relaxed">
            Acá ves todos los prospectos del programa. Cada card es una persona que llenó el formulario en jiujitsulatino.com.
          </p>
          <p className="text-sm text-jjl-muted leading-relaxed mt-2">
            Tu trabajo arranca con la primera columna: <strong className="text-white">&ldquo;Sin agendar (llenó form)&rdquo;</strong>. Esos son los que tenés que llamar/escribir para que reserven la consultoría gratuita.
          </p>
        </>
      ),
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: 'Las columnas de izquierda a derecha',
      body: (
        <ul className="space-y-2 text-sm text-jjl-muted leading-relaxed">
          <li><span className="inline-block w-3 h-3 rounded bg-blue-500/40 mr-2 align-middle" /><strong className="text-white">Sin agendar</strong> — llenaron form, no reservaron Calendly.</li>
          <li><span className="inline-block w-3 h-3 rounded bg-amber-500/40 mr-2 align-middle" /><strong className="text-white">Agendados</strong> — ya reservaron call.</li>
          <li><span className="inline-block w-3 h-3 rounded bg-purple-500/40 mr-2 align-middle" /><strong className="text-white">Contactado</strong> — vos los moviste acá manual cuando los contactás.</li>
          <li><span className="inline-block w-3 h-3 rounded bg-jjl-border mr-2 align-middle" /><strong className="text-white">Descartado</strong> — no aplica o se autoexcluyó.</li>
          <li><span className="inline-block w-3 h-3 rounded bg-green-500/40 mr-2 align-middle" /><strong className="text-white">Convertido 💰</strong> — compró el programa. Acá ves tu comisión.</li>
        </ul>
      ),
    },
    {
      icon: <AlertTriangle className="h-6 w-6 text-amber-400" />,
      title: 'Los colores te avisan',
      body: (
        <>
          <div className="rounded-lg border border-amber-500/60 bg-amber-500/[0.06] p-2.5 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1">Amarillo</p>
            <p className="text-sm text-jjl-muted">El prospecto dijo que su trabajo es <strong className="text-amber-300">inestable</strong>. Ojo con el cash flow — capaz hay que mostrarle planes en cuotas o el plan más accesible.</p>
          </div>
          <div className="rounded-lg border border-red-500/60 bg-red-500/[0.06] p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-300 mb-1">Rojo</p>
            <p className="text-sm text-jjl-muted">El prospecto dijo que <strong className="text-red-300">no está dispuesto a invertir ahora</strong>. Igual contactalo, pero baja la prioridad: probablemente no compre en esta tanda.</p>
          </div>
        </>
      ),
    },
    {
      icon: <X className="h-6 w-6 text-red-400" />,
      title: 'Descartar en 1 click',
      body: (
        <>
          <p className="text-sm text-jjl-muted leading-relaxed">
            Cuando pasás el mouse por una card aparece un <strong className="text-white">círculo negro con una X</strong> arriba a la derecha. Click ahí → manda el lead a Descartado al toque.
          </p>
          <p className="text-sm text-jjl-muted leading-relaxed mt-2">
            Útil para esos que ya sabés que no van — no perdés tiempo abriendo cada ficha.
          </p>
        </>
      ),
    },
    {
      icon: <Bell className="h-6 w-6 text-blue-400" />,
      title: 'Te avisamos sin que tengas que estar mirando',
      body: (
        <>
          <p className="text-sm text-jjl-muted leading-relaxed">
            Te llega notificación al instante cuando:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-jjl-muted leading-relaxed pl-4 list-disc">
            <li>Alguien <strong className="text-green-300">agenda</strong> una consultoría.</li>
            <li>Alguien llenó el form y <strong className="text-amber-300">pasaron 2 horas sin agendar</strong>.</li>
          </ul>
          <p className="text-sm text-jjl-muted leading-relaxed mt-2">
            Las ves en la campanita arriba y, si diste permiso, también como notificación del navegador.
          </p>
        </>
      ),
    },
    {
      icon: <Trophy className="h-6 w-6 text-green-400" />,
      title: 'Tu comisión: 5% sobre lo cobrado',
      body: (
        <>
          <p className="text-sm text-jjl-muted leading-relaxed">
            En la columna <strong className="text-green-300">Convertido</strong> cada card muestra el <strong className="text-white">monto cobrado</strong> y al lado, en verde, tu <strong className="text-green-300">+$ comisión (5%)</strong>.
          </p>
          <div className="my-2 rounded-lg border border-green-500/40 bg-green-500/[0.06] p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-extrabold text-white tabular-nums">$1.000.000 ARS</span>
              <span className="text-[11px] font-bold text-green-300 tabular-nums">+$50.000</span>
            </div>
            <p className="text-[10px] text-jjl-muted mt-0.5 flex items-center gap-1">
              <DollarSign className="h-2.5 w-2.5" />
              3 cuotas
            </p>
          </div>
          <ul className="space-y-1 text-[12px] text-jjl-muted">
            <li>· Cada <strong className="text-white">cuota</strong> que se cobra suma su 5%.</li>
            <li>· Los <strong className="text-white">fees / reservas</strong> NO suman comisión (aparecen como &ldquo;no suma&rdquo;).</li>
            <li>· Arriba a la derecha del panel ves el <strong className="text-green-300">total acumulado de tu comisión</strong>.</li>
          </ul>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-jjl-border bg-jjl-bg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-jjl-red/15 to-transparent border-b border-jjl-border">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-jjl-red/15 ring-1 ring-jjl-red/30 text-jjl-red flex items-center justify-center">
              {current.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-jjl-muted">
                Guía rápida ({step + 1}/{steps.length})
              </p>
              <h2 className="text-base font-black text-white">{current.title}</h2>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-jjl-muted hover:text-white transition-colors"
            title="Saltar guía"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 min-h-[180px]">
          {current.body}
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-jjl-red' : 'w-1.5 bg-white/15 hover:bg-white/30'}`}
              aria-label={`Ir al paso ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border-t border-jjl-border">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 text-[12px] text-jjl-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Atrás
          </button>
          {isLast ? (
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1 px-4 h-9 rounded-lg bg-jjl-red hover:bg-jjl-red-light text-white text-[12px] font-bold uppercase tracking-wider transition-colors"
            >
              Empezar
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[12px] font-bold transition-colors"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

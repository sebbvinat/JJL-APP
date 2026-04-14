'use client';

import { Activity, Sparkles, Search } from 'lucide-react';
import Shell from './Shell';

interface Props {
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export default function Step3Journal({ onNext, onSkip }: Props) {
  return (
    <Shell
      step={3}
      total={5}
      title="Tu diario"
      subtitle="Es el corazon de la app. Tres minutos por dia alcanzan — y todo lo que escribas queda para revisar cuando quieras."
      primaryLabel="Siguiente"
      onPrimary={onNext}
      onSkip={onSkip}
    >
      <div className="space-y-3">
        {[
          {
            icon: Activity,
            tone: 'bg-jjl-red/10 ring-jjl-red/25 text-jjl-red',
            title: 'Un check-in por dia',
            body: 'Entrenaste, como te sentiste, que tan intenso fue, un puntaje. Diez segundos.',
          },
          {
            icon: Sparkles,
            tone: 'bg-yellow-500/10 ring-yellow-500/25 text-yellow-400',
            title: 'Reflexion que persiste',
            body: 'Que aprendiste hoy, notas sueltas, links utiles. Todo se guarda 120 dias.',
          },
          {
            icon: Search,
            tone: 'bg-blue-500/10 ring-blue-500/25 text-blue-400',
            title: 'Revisable en cualquier momento',
            body: 'Buscas en la Biblioteca por tema (guardia, pasajes, submissions) o por palabras.',
          },
        ].map((row, i) => {
          const Icon = row.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-jjl-border bg-white/[0.02] p-4"
            >
              <span
                className={`h-9 w-9 rounded-lg flex items-center justify-center ring-1 shrink-0 ${row.tone}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-white">{row.title}</p>
                <p className="text-[12px] text-jjl-muted mt-0.5 leading-relaxed">{row.body}</p>
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-jjl-red/25 bg-jjl-red/[0.05] p-4 text-[12px] text-white/80 leading-relaxed">
          <span className="uppercase tracking-[0.14em] text-jjl-red font-bold text-[10px] block mb-1">
            Tip
          </span>
          Los domingos a la noche hacemos el <em>ritual</em> — revisas tu semana, fijas foco para la
          siguiente. Te vamos a notificar cuando toque.
        </div>
      </div>
    </Shell>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import AgendaRapida from '@/components/agendar/AgendaRapida';
import { CALENDLY_URL } from '@/lib/calendly-url';

export const metadata: Metadata = {
  title: 'Agendá tu llamada — Jiu Jitsu Latino',
  description:
    'Tres preguntas y elegís el horario. Sesión 1 a 1 para analizar tu juego según tu cuerpo, tu edad y tus objetivos.',
  // No queremos que esta pagina compita en Google con la landing de
  // consultoria: es el paso 2 de un recorrido, no una puerta de entrada.
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-jjl-dark text-white">
      <header className="flex items-center justify-center gap-2.5 border-b border-jjl-border/60 px-5 py-4">
        <Image src="/logo-jjl.png" alt="Jiu Jitsu Latino" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/70">
          Jiu Jitsu Latino
        </span>
      </header>
      <AgendaRapida calendlyUrl={CALENDLY_URL} />
    </main>
  );
}

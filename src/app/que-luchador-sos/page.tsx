import type { Metadata } from 'next';
import MatchQuiz from '@/components/match-quiz/MatchQuiz';

export const metadata: Metadata = {
  title: '¿A qué luchador te parecés? — Jiu Jitsu Latino',
  description:
    'Test de 60 segundos. Descubrí a qué leyenda del jiu-jitsu se parece tu juego — basado en tu biotipo, tu estilo y tu zona de comodidad.',
};

export default function Page() {
  return (
    <main className="min-h-screen bg-jjl-dark text-white">
      <MatchQuiz />
    </main>
  );
}

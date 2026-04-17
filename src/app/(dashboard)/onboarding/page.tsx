'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Dumbbell, BookOpen, Target, MessageCircle, CheckCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import { useUser } from '@/hooks/useUser';

const STEPS = [
  {
    title: 'Bienvenido a JJL',
    desc: 'Tu programa personalizado de Jiu Jitsu te espera. En 6 meses vas a construir tu juego ideal.',
    icon: Dumbbell,
    tip: 'Cada semana tiene videos, drills y reflexiones para que progreses a tu ritmo.',
  },
  {
    title: 'Tu rutina diaria',
    desc: 'Cada dia de entrenamiento, abri el Diario y registra tu sesion. Ponete un objetivo y una regla.',
    icon: Target,
    tip: 'El diario te ayuda a ser mas consciente de tu entrenamiento. Puntajte del 1 al 10 cada dia.',
  },
  {
    title: 'Tus modulos',
    desc: 'Tu instructor te va a ir desbloqueando modulos semanalmente. Cada uno tiene videos y drills.',
    icon: BookOpen,
    tip: 'Mira los videos, practica los drills, y marca las lecciones como completadas.',
  },
  {
    title: 'La comunidad',
    desc: 'Compartí tu progreso, hacé preguntas, y conecta con otros guerreros del programa.',
    icon: MessageCircle,
    tip: 'Usa el Chat para hablar directo con tu instructor. La Comunidad es para compartir con todos.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { profile } = useUser();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      router.push('/dashboard');
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-jjl-red' : i < step ? 'w-4 bg-jjl-red/40' : 'w-4 bg-jjl-border'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-jjl-red/10 via-transparent to-transparent pointer-events-none" />

          <div className="relative text-center py-6 space-y-5">
            {/* Welcome with avatar on first step */}
            {step === 0 && profile?.nombre && (
              <div className="flex flex-col items-center gap-2 mb-2">
                <Avatar name={profile.nombre} size="lg" />
                <p className="text-sm text-jjl-muted">Hola, {profile.nombre}!</p>
              </div>
            )}

            <div className="h-16 w-16 mx-auto rounded-2xl bg-jjl-red/15 flex items-center justify-center">
              <Icon className="h-8 w-8 text-jjl-red" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{current.title}</h1>
              <p className="text-sm text-jjl-muted leading-relaxed">{current.desc}</p>
            </div>

            {/* Tip box */}
            <div className="bg-jjl-gray-light/50 border border-jjl-border rounded-xl px-4 py-3 text-left">
              <p className="text-xs text-jjl-muted font-semibold uppercase tracking-wider mb-1">Tip</p>
              <p className="text-sm text-white/80">{current.tip}</p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
              Atras
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={next} className="flex-1">
            {isLast ? (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Empezar
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="h-5 w-5 ml-1" />
              </>
            )}
          </Button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-xs text-jjl-muted hover:text-white py-2"
          >
            Saltar intro
          </button>
        )}
      </div>
    </div>
  );
}

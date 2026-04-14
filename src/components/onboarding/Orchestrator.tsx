'use client';

import { useState } from 'react';
import Shell from './Shell';
import Step1Welcome from './Step1Welcome';
import Step2Program from './Step2Program';
import Step3Journal from './Step3Journal';
import Step4Notifications from './Step4Notifications';

const TOTAL_STEPS = 5;

interface OrchestratorProps {
  initialStep: number;
  userName: string;
  userRole: string;
  userBelt: string;
}

export default function Orchestrator({ initialStep, userName, userRole, userBelt }: OrchestratorProps) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), TOTAL_STEPS));

  async function advance(next: number, opts: { complete?: boolean } = {}) {
    await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: next, complete: opts.complete }),
    });
    if (opts.complete) {
      window.location.href = '/dashboard';
      return;
    }
    setStep(next);
  }

  if (step === 1) {
    return <Step1Welcome userName={userName} onNext={() => advance(2)} />;
  }

  if (step === 2) {
    return (
      <Step2Program
        isAdmin={userRole === 'admin'}
        onNext={() => advance(3)}
        onSkip={() => advance(3)}
      />
    );
  }

  if (step === 3) {
    return <Step3Journal onNext={() => advance(4)} onSkip={() => advance(4)} />;
  }

  if (step === 4) {
    return <Step4Notifications onNext={() => advance(5)} onSkip={() => advance(5)} />;
  }

  // Placeholder — real step components come in Task 9.
  return (
    <Shell
      step={step}
      total={TOTAL_STEPS}
      title={`Paso ${step} — pendiente`}
      subtitle={`Hola ${userName}. Rol: ${userRole}. Cinturon: ${userBelt}.`}
      onPrimary={() =>
        step < TOTAL_STEPS ? advance(step + 1) : advance(TOTAL_STEPS, { complete: true })
      }
    >
      <p className="text-white/70 text-sm">Contenido del paso {step} llega en las proximas tareas.</p>
    </Shell>
  );
}

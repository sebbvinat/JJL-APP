'use client';

import { useState } from 'react';
import Shell from './Shell';

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

  // Placeholder — real step components come in Tasks 5-9.
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

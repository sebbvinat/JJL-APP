'use client';

import { useState } from 'react';
import Step1Welcome from './Step1Welcome';
import Step2Program from './Step2Program';
import Step3Journal from './Step3Journal';
import Step4Notifications from './Step4Notifications';
import Step5Introduction from './Step5Introduction';

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

  if (step === 5) {
    return (
      <Step5Introduction
        userName={userName}
        userBelt={userBelt}
        isAdmin={userRole === 'admin'}
        onComplete={() => advance(5, { complete: true })}
      />
    );
  }

  // Unknown step — should be impossible given the clamp; recover defensively.
  void advance(1);
  return null;
}

'use client';

import { useState } from 'react';
import { Bell, BellOff, CheckCircle } from 'lucide-react';
import Shell from './Shell';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Props {
  onNext: () => Promise<void>;
  onSkip: () => Promise<void>;
}

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

function currentPermState(): PermState {
  if (typeof window === 'undefined') return 'default';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as PermState;
}

export default function Step4Notifications({ onNext, onSkip }: Props) {
  const [state, setState] = useState<PermState>(currentPermState());
  const [working, setWorking] = useState(false);
  const toast = useToast();

  async function enable() {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      setState(permission as PermState);
      if (permission !== 'granted') {
        setWorking(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        }));
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      toast.success('Notificaciones activadas');
      await onNext();
    } catch (err) {
      logger.error('onboarding.step4.subscribe.failed', { err });
      toast.error('No pudimos activarlas. Podes hacerlo mas tarde desde la campanita.');
    }
    setWorking(false);
  }

  return (
    <Shell
      step={4}
      total={5}
      title="Activa las alertas"
      subtitle="Te avisamos cuando tu instructor responde un video, cuando se desbloquea un modulo nuevo, o cuando hace falta el check-in del dia. Las podes apagar cuando quieras."
      primaryLabel={null}
      onSkip={onSkip}
      skipLabel="Despues"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ${
                state === 'granted'
                  ? 'bg-green-500/10 ring-green-500/25 text-green-400'
                  : state === 'denied'
                    ? 'bg-red-500/10 ring-red-500/25 text-red-400'
                    : 'bg-jjl-red/10 ring-jjl-red/25 text-jjl-red'
              }`}
            >
              {state === 'granted' ? (
                <CheckCircle className="h-5 w-5" />
              ) : state === 'denied' ? (
                <BellOff className="h-5 w-5" />
              ) : (
                <Bell className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-bold text-white">
                {state === 'granted'
                  ? 'Listas'
                  : state === 'denied'
                    ? 'Bloqueadas por el browser'
                    : state === 'unsupported'
                      ? 'Este browser no las soporta'
                      : 'Sin activar'}
              </p>
              <p className="text-[12px] text-jjl-muted">
                {state === 'denied'
                  ? 'Podes habilitarlas en la configuracion del sitio y reintentar.'
                  : state === 'unsupported'
                    ? 'No pasa nada — seguimos sin push.'
                    : 'Un click y listo.'}
              </p>
            </div>
          </div>

          {state === 'default' && (
            <Button variant="primary" size="md" onClick={enable} loading={working} fullWidth>
              <Bell className="h-4 w-4" />
              Activar notificaciones
            </Button>
          )}
          {state === 'granted' && (
            <Button variant="secondary" size="md" onClick={onNext} fullWidth>
              Continuar
            </Button>
          )}
          {(state === 'denied' || state === 'unsupported') && (
            <Button variant="secondary" size="md" onClick={onNext} fullWidth>
              Seguir sin notificaciones
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}

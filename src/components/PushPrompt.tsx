'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { logger, esErrorDeRed, reintentarSiFallaLaRed } from '@/lib/logger';
import { useToast } from '@/components/ui/Toast';

// Estas dos funciones viven fuera del componente porque no usan nada de él:
// así el useEffect de abajo las puede llamar sin depender de funciones que se
// recrean en cada render (era un error de lint: se usaban antes de declararse).

type ResultadoGuardado = 'ok' | 'sin-red' | 'fallo';

/**
 * Manda la suscripción al servidor. Devuelve el resultado en vez de mostrar el
 * toast acá porque quien llama sabe si el alumno pidió algo o no (ver
 * subscribeQuietly).
 */
async function saveSubscription(subscription: PushSubscription): Promise<ResultadoGuardado> {
  try {
    // Un reintento a los 1,5 s: el corte típico del celular dura menos que
    // eso. Es seguro repetir el pedido porque el endpoint hace upsert por
    // (user_id, endpoint).
    const res = await reintentarSiFallaLaRed(() =>
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      }),
    );
    if (!res.ok) {
      logger.error('push.saveSubscription.badStatus', { status: res.status });
      return 'fallo';
    }
    return 'ok';
  } catch (err) {
    if (esErrorDeRed(err)) {
      // Red mala, no un bug: warn (consola sí, client_errors no). Antes salía
      // como error y los "Load failed" de iOS tapaban los errores reales.
      logger.warn('push.saveSubscription.failed', { err });
      return 'sin-red';
    }
    logger.error('push.saveSubscription.failed', { err });
    return 'fallo';
  }
}

/**
 * Camino silencioso: corre solo cada vez que se abre la app con el permiso ya
 * dado. No muestra toast aunque falle la red: un "Sin conexión" por algo que
 * el alumno no pidió confunde más de lo que ayuda, y la próxima vez que abra
 * la app se reintenta igual.
 */
async function subscribeQuietly() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Already subscribed, send to server
      await saveSubscription(existing);
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    await saveSubscription(subscription);
  } catch (err) {
    logger.warn('push.subscribeQuietly.failed', { err });
  }
}

export default function PushPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  // El ToastProvider está en el layout raíz, así que acá siempre hay contexto.
  const toast = useToast();

  useEffect(() => {
    // Only show if push is supported and not already subscribed
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'granted') {
      // Already granted — ensure subscription exists
      subscribeQuietly();
      return;
    }
    if (Notification.permission === 'denied') return;

    // Show prompt after 3 seconds
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  async function handleEnable() {
    setShowPrompt(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      // Acá sí avisamos: el alumno acaba de tocar "Activar" y espera que pase
      // algo. El permiso ya quedó dado, así que aunque ahora falle la red, la
      // próxima vez que abra la app subscribeQuietly lo termina de guardar.
      const resultado = await saveSubscription(subscription);
      if (resultado === 'sin-red') toast.warning('Sin conexión, probá de nuevo');
    } catch (err) {
      logger.error('push.handleEnable.failed', { err });
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:bottom-6 lg:left-auto lg:right-6 lg:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-jjl-gray border border-jjl-border rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-jjl-red/20 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-jjl-red" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Activar notificaciones</p>
            <p className="text-xs text-jjl-muted mt-0.5">
              Recibí alertas cuando se desbloquee un modulo nuevo o avances de cinturon
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                className="px-4 py-1.5 bg-jjl-red text-white text-xs font-semibold rounded-lg hover:bg-jjl-red-hover transition-colors"
              >
                Activar
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="px-4 py-1.5 text-jjl-muted text-xs rounded-lg hover:bg-jjl-gray-light transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import Shell from './Shell';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import { BELT_LABELS } from '@/lib/constants';

interface Props {
  userName: string;
  userBelt: string;
  isAdmin: boolean;
  onComplete: () => Promise<void>;
}

export default function Step5Introduction({ userName, userBelt, isAdmin, onComplete }: Props) {
  const [cinturon, setCinturon] = useState(BELT_LABELS[userBelt] || userBelt || '');
  const [tiempoEntrenando, setTiempoEntrenando] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [desafio, setDesafio] = useState('');
  const [working, setWorking] = useState(false);
  const [alreadyPosted, setAlreadyPosted] = useState<boolean | null>(null);
  const toast = useToast();

  // Detect if the user already has a community post — if so, allow skip.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/community/posts?mine=1')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data: { posts?: Array<{ id: string }> }) => {
        if (!cancelled) setAlreadyPosted((data.posts?.length ?? 0) > 0);
      })
      .catch(() => {
        if (!cancelled) setAlreadyPosted(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const contenido = [
    `Hola, soy ${userName}${isAdmin ? ' — instructor de JJL' : ''}.`,
    !isAdmin && cinturon ? `Cinturon ${cinturon}.` : '',
    !isAdmin && tiempoEntrenando ? `Hace ${tiempoEntrenando} que entreno.` : '',
    objetivo ? `Mi objetivo en JJL: ${objetivo}.` : '',
    desafio ? `Mi desafio actual: ${desafio}.` : '',
    '¡Vamos!',
  ]
    .filter(Boolean)
    .join(' ');

  const titulo = isAdmin
    ? `${userName} se suma al equipo — como instructor`
    : `${userName} — me presento`;

  async function publish() {
    setWorking(true);
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, contenido, categoria: 'progress' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'No pudimos publicar el post');
      }
      toast.success('Estas adentro. Bienvenido al equipo.');
      await onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al publicar';
      logger.error('onboarding.step5.publish.failed', { err });
      toast.error(msg);
    }
    setWorking(false);
  }

  async function skip() {
    setWorking(true);
    await onComplete();
    setWorking(false);
  }

  const canPublish = !!objetivo.trim() && !working;

  return (
    <Shell
      step={5}
      total={5}
      title={alreadyPosted ? 'Ya te presentaste' : 'Presentate al equipo'}
      subtitle={
        alreadyPosted
          ? 'Tu presentacion esta publicada. Podes actualizarla desde Comunidad cuando quieras.'
          : 'El foro crece cuando cada uno se muestra. Un post corto abre la puerta a que los demas te conozcan.'
      }
      primaryLabel={alreadyPosted ? 'Ir al dashboard' : 'Publicar y terminar'}
      primaryDisabled={!alreadyPosted && !canPublish}
      primaryLoading={working}
      onPrimary={alreadyPosted ? skip : publish}
      onSkip={alreadyPosted ? null : skip}
      skipLabel="Despues"
    >
      {alreadyPosted ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/[0.05] p-5 flex items-start gap-3">
          <Check className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-white/80">
            Ya tenes un post en la comunidad. Listo para entrar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4 space-y-3">
            {!isAdmin && (
              <>
                <Input
                  label="Que cinturon sos"
                  placeholder="Blanco con 2 grados"
                  value={cinturon}
                  onChange={(e) => setCinturon(e.target.value)}
                />
                <Input
                  label="Hace cuanto entrenas"
                  placeholder="2 años, desde 2022, 6 meses..."
                  value={tiempoEntrenando}
                  onChange={(e) => setTiempoEntrenando(e.target.value)}
                />
              </>
            )}
            <Input
              label="Tu objetivo en JJL"
              placeholder="Cerrar mi juego de guardia, competir en azul"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              hint="Obligatorio"
            />
            <Input
              label="Tu desafio actual"
              placeholder="Me cuesta el pase contra gente pesada"
              value={desafio}
              onChange={(e) => setDesafio(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-jjl-red/30 bg-jjl-red/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-jjl-red" />
              <p className="text-[11px] uppercase tracking-[0.14em] text-jjl-red font-bold">
                Tu post
              </p>
            </div>
            <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">
              {contenido || 'Llena los campos de arriba para ver tu post.'}
            </p>
          </div>
        </div>
      )}
    </Shell>
  );
}

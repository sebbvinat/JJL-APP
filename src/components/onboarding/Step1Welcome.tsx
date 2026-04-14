'use client';

import { useState } from 'react';
import { Shield, Users as UsersIcon, Target } from 'lucide-react';
import Shell from './Shell';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

interface Props {
  userName: string;
  onNext: () => Promise<void>;
}

export default function Step1Welcome({ userName, onNext }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const canSubmit = password.length >= 8 && password === confirm && !saving;

  async function handleSubmit() {
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      toast.success('Contraseña guardada');
      await onNext();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No pudimos guardar la contraseña';
      logger.error('onboarding.step1.password.failed', { err });
      setError(msg);
      toast.error(msg);
    }
    setSaving(false);
  }

  return (
    <Shell
      step={1}
      total={5}
      title={`Bienvenido, ${userName}`}
      subtitle="Hoy arrancas 180 dias de entrenamiento con foco. Cada dia que registres se convierte en tu radar de progreso — y cuando lo compartis, el equipo crece con vos."
      primaryLabel="Guardar y seguir"
      primaryDisabled={!canSubmit}
      primaryLoading={saving}
      onPrimary={handleSubmit}
    >
      <div className="space-y-5">
        <ul className="space-y-2.5 text-[13px] text-jjl-muted">
          {[
            { icon: Target, text: '180 dias estructurados, con objetivos semanales y mediciones claras.' },
            { icon: UsersIcon, text: 'Equipo visible — otros alumnos comparten sus luchas, dudas y logros.' },
            { icon: Shield, text: 'Tu diario es privado salvo que decidas publicarlo en la comunidad.' },
          ].map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="pt-4 border-t border-jjl-border space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-jjl-muted">
            Primera tarea: elegi tu contraseña
          </p>
          <Input
            label="Contraseña nueva"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 8 caracteres"
            hint="La que te pase tu instructor por WhatsApp era temporal."
          />
          <Input
            label="Repetila"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
      </div>
    </Shell>
  );
}

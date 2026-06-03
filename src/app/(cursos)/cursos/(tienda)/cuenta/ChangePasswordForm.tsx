'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import LightButton from '@/components/cursos/ui/LightButton';
import { createClient } from '@/lib/supabase/client';

// Form de cambio de contraseña. Requiere la contraseña actual para
// validar antes de actualizar — defensa contra sesiones secuestradas.
export default function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!current) {
      setError('Ingresá tu contraseña actual.');
      return;
    }
    if (next.length < 6) {
      setError('La contraseña nueva tiene que tener al menos 6 caracteres.');
      return;
    }
    if (next !== confirm) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (next === current) {
      setError('La contraseña nueva tiene que ser distinta de la actual.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Verificar contraseña actual
    const { error: signinErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signinErr) {
      setError('La contraseña actual no es correcta.');
      setLoading(false);
      return;
    }

    // Actualizar a la nueva
    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }

    setSuccess('Contraseña actualizada. La próxima vez que entres usá esta nueva.');
    setCurrent('');
    setNext('');
    setConfirm('');
    setLoading(false);
  };

  const inputCls =
    'w-full rounded-lg border border-cursos-line-strong bg-cursos-surface px-3.5 py-2.5 text-[15px] text-cursos-ink outline-none transition-colors placeholder:text-cursos-muted focus:border-cursos-red';

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-cursos-muted">
          Contraseña actual
        </span>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-cursos-muted">
          Contraseña nueva
        </span>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-cursos-muted">
          Repetí la contraseña nueva
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-3.5 py-2.5 text-[13px] font-medium text-green-700">
          {success}
        </p>
      )}

      <LightButton type="submit" disabled={loading} size="lg" fullWidth>
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </LightButton>
    </form>
  );
}

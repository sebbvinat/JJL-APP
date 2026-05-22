'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import LightButton from '@/components/cursos/ui/LightButton';

export default function CursosLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }
    router.push('/mis-cursos');
    router.refresh();
  };

  const handleReset = async () => {
    if (!email) {
      setError('Ingresá tu email para recuperar la contraseña.');
      return;
    }
    setError('');
    setResetLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/mis-cursos`,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setResetLoading(false);
  };

  const inputClass =
    'w-full rounded-xl border border-cursos-line-strong bg-cursos-surface px-4 py-3 text-[15px] text-cursos-ink outline-none transition-colors placeholder:text-cursos-muted focus:border-cursos-red';

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <Image
            src="/logo-jjl.png"
            alt="Jiu Jitsu Latino"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
          <h1 className="font-display mt-4 text-2xl font-extrabold tracking-[-0.02em] text-cursos-ink">
            Ingresá a tus cursos
          </h1>
          <p className="mt-1.5 text-[14px] text-cursos-muted">
            Accedé a los instruccionales que compraste.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-cursos-line bg-cursos-surface p-6 shadow-[var(--shadow-cursos)]">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-cursos-muted"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-cursos-muted"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-cursos-red/10 px-3 py-2.5 text-[13px] font-medium text-cursos-red-dark">
                {error}
              </p>
            )}
            {resetSent && (
              <p className="rounded-lg bg-black/[0.04] px-3 py-2.5 text-[13px] text-cursos-ink-soft">
                Te enviamos un email con un link para recuperar tu contraseña.
              </p>
            )}

            <LightButton type="submit" size="lg" fullWidth disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </LightButton>
          </form>

          <div className="my-4 border-t border-cursos-line" />
          <button
            type="button"
            onClick={handleReset}
            disabled={resetLoading}
            className="w-full text-center text-[13px] font-medium text-cursos-muted transition-colors hover:text-cursos-red"
          >
            {resetLoading ? 'Enviando…' : 'Olvidé mi contraseña'}
          </button>
        </div>

        <p className="mt-5 text-center text-[13px] text-cursos-muted">
          ¿No tenés cuenta? Se crea automáticamente al comprar un curso.
        </p>
      </div>
    </div>
  );
}

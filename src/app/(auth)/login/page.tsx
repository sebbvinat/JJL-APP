'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function LoginPage() {
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Ingresa tu email para recuperar la contraseña');
      return;
    }
    setError('');
    setResetLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/profile?reset=1`,
    });

    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  };

  return (
    <div className="relative w-full max-w-sm">
      {/* Subtle background radial gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-jjl-red)_0%,_transparent_70%)] opacity-[0.05] pointer-events-none" />

      <div className="relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo-jjl.png"
            alt="JJL"
            width={72}
            height={72}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold">JIU JITSU LATINO</h1>
          <p className="text-jjl-muted text-sm mt-1">Inicia sesion en tu cuenta</p>
        </div>

        {/* Form card with glow border */}
        <div className="rounded-2xl border border-jjl-border bg-jjl-gray/60 p-6 shadow-lg shadow-black/40 ring-1 ring-jjl-red/[0.08]">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Contrasena"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {resetSent && (
              <div className="bg-green-900/30 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
                Te enviamos un email con un link para recuperar tu contraseña. Revisa tu bandeja de entrada.
              </div>
            )}

            <Button type="submit" size="lg" className="w-full shadow-lg shadow-jjl-red/25 hover:shadow-xl hover:shadow-jjl-red/30" loading={loading}>
              Iniciar Sesion
            </Button>
          </form>

          {/* Visual separator */}
          <div className="my-4 border-t border-jjl-border/50" />

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetLoading}
            className="w-full text-center text-sm text-jjl-muted hover:text-white transition-colors py-1"
          >
            {resetLoading ? 'Enviando...' : 'Olvide mi contraseña'}
          </button>
        </div>

        <p className="text-center text-sm text-jjl-muted mt-5">
          No tienes cuenta? Contacta a tu instructor para obtener acceso.
        </p>
      </div>
    </div>
  );
}

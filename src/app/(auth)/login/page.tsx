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
      <div className="relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4 w-[88px] h-[88px] rounded-full bg-white p-2.5 flex items-center justify-center shadow-xl shadow-jjl-red/20 ring-1 ring-white/10">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-lg opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.9), transparent 70%)' }}
            />
            <img
              src="/logo-jjl.png"
              alt="JJL"
              width={64}
              height={64}
              className="relative z-10"
            />
          </div>
          <h1 className="text-[22px] font-extrabold tracking-[0.18em] leading-none">
            JIU JITSU LATINO
          </h1>
          <div className="mt-2 h-px w-10 bg-gradient-to-r from-transparent via-jjl-red to-transparent" />
          <p className="text-jjl-muted text-xs mt-2 tracking-wide uppercase">Elite Coaching</p>
        </div>

        {/* Form card with glow border */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] backdrop-blur-sm p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-jjl-red/10">
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

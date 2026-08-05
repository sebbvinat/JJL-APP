'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// El boton de Google solo aparece si el proveedor esta configurado en
// Supabase. Asi el codigo puede estar en produccion sin mostrar un boton
// que tiraria error al tocarlo.
const GOOGLE_HABILITADO = process.env.NEXT_PUBLIC_GOOGLE_AUTH === '1';

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.2-3.8 6.6-9.5 6.6-15.7" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.7 5.2-.1.3C8 40.4 15.4 46 24 46" />
      <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .7-4.4v-.3l-6.8-5.3-.2.1A22 22 0 0 0 2 24c0 3.5.9 6.9 2.4 9.9z" />
      <path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 8 6.6 4.4 14.1l7 5.5C13.3 14.3 18.2 9.5 24 9.5" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // El cliente usa flowType 'implicit': Google no vuelve por /auth/callback
  // con un `code`, vuelve aca con la sesion en el hash de la URL. supabase-js
  // la levanta sola al cargar la pagina; nosotros solo escuchamos el evento
  // para mandarlo al dashboard.
  //
  // Si el email no es de un alumno, Supabase rechaza el alta (la plataforma
  // es solo por invitacion, con el registro cerrado) y vuelve con el error
  // en el hash o en la query. Ese mensaje viene en ingles y tecnico, asi que
  // lo traducimos a algo que el alumno entienda.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthError = qs.get('error_description') || hash.get('error_description') || qs.get('error') || hash.get('error');
    if (oauthError) {
      setError(
        /signup|not allowed|disabled/i.test(oauthError)
          ? 'Esa cuenta de Google no esta habilitada en la plataforma. Escribile a tu instructor para que te den acceso.'
          : oauthError,
      );
    }

    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/dashboard');
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

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

          {GOOGLE_HABILITADO && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-jjl-border/50" />
                <span className="text-[11px] uppercase tracking-wider text-jjl-muted">o</span>
                <div className="h-px flex-1 bg-jjl-border/50" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                <LogoGoogle />
                {googleLoading ? 'Abriendo Google...' : 'Continuar con Google'}
              </button>
            </>
          )}

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

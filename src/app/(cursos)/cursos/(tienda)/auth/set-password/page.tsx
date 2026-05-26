'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LightContainer from '@/components/cursos/ui/LightContainer';
import LightButton from '@/components/cursos/ui/LightButton';
import { createClient } from '@/lib/supabase/client';

// Pagina para que un cliente migrado (o cualquier usuario que pidio
// "olvide mi contrasenia") setea su clave nueva. Supabase se encarga
// de validar la sesion de recuperacion via el link del mail.

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');

  useEffect(() => {
    let mounted = true;
    // El link de recuperacion de Supabase llega con:
    //  - #access_token=...  (flow implicit)  -> el SDK lo detecta solo
    //  - ?code=XYZ  (flow PKCE legacy)  -> hay que exchange-ar a mano
    //  - ?error=...&error_description=... -> link expirado/invalido
    //
    // Siempre mostramos el form salvo que haya un error explicito. Asi
    // evitamos falsos "expirado" cuando la sesion tarda en aparecer.
    // Si el usuario submite sin sesion, updateUser falla y mostramos el
    // error real.
    const init = async () => {
      const url = new URL(window.location.href);
      const err =
        url.searchParams.get('error') ||
        new URLSearchParams(window.location.hash.slice(1)).get('error');
      if (err) {
        if (mounted) setReady('invalid');
        return;
      }

      const code = url.searchParams.get('code');
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
          url.searchParams.delete('code');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch {
          /* si falla, dejamos el form igual — el submit dira el motivo */
        }
      }

      if (mounted) setReady('ok');
    };
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (upErr) {
      // Si el link estaba realmente vencido/usado, updateUser falla con
      // "Auth session missing" o similar. Le damos un mensaje claro y
      // un link para pedir el reset de nuevo.
      const msg = /session|expired|not_admin|jwt/i.test(upErr.message)
        ? 'El link expiró o ya se usó. Pedí uno nuevo desde Login → "Olvidé mi contraseña".'
        : upErr.message;
      setError(msg);
      return;
    }
    router.push('/mis-cursos');
    router.refresh();
  };

  const inputCls =
    'w-full rounded-lg border border-cursos-line-strong bg-cursos-surface px-3.5 py-2.5 text-sm text-cursos-ink outline-none focus:border-cursos-red';

  return (
    <LightContainer size="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md rounded-2xl border border-cursos-line bg-cursos-surface p-7 shadow-[var(--shadow-cursos-sm)] sm:p-9">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-cursos-red">
          Tu plataforma
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-cursos-ink sm:text-3xl">
          Setea tu contraseña
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-cursos-ink-soft">
          Solo es la primera vez. Después entrás como siempre desde la página de login.
        </p>

        {ready === 'checking' && (
          <p className="mt-6 text-[13px] text-cursos-muted">Verificando el link…</p>
        )}

        {ready === 'invalid' && (
          <div className="mt-6 rounded-lg bg-black/[0.04] p-4 text-[13.5px] text-cursos-ink-soft">
            El link de recuperación expiró o ya se usó. Volvé a pedirlo desde la
            pantalla de <a href="/login" className="font-semibold text-cursos-red underline">login</a> con
            "Olvidé mi contraseña".
          </div>
        )}

        {ready === 'ok' && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-cursos-muted">
                Nueva contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="new-password"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-cursos-muted">
                Repetí la contraseña
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
              <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                {error}
              </p>
            )}
            <LightButton type="submit" disabled={loading} fullWidth size="lg">
              {loading ? 'Guardando…' : 'Guardar y entrar'}
            </LightButton>
          </form>
        )}
      </div>
    </LightContainer>
  );
}

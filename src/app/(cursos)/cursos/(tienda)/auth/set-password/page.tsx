'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LightContainer from '@/components/cursos/ui/LightContainer';
import LightButton from '@/components/cursos/ui/LightButton';
import { createClient } from '@/lib/supabase/client';

// Pagina para que un cliente migrado (o cualquier usuario que pidio
// "olvide mi contrasenia") setea su clave nueva. Supabase se encarga
// de validar la sesion de recuperacion via el link del mail.
//
// Si el link expiro o ya se uso (caso comun: prefetchers de mail como
// Outlook/iOS Mail consumen el OTP antes del click), mostramos inline
// el formulario para pedir uno nuevo — sin obligar a volver a /login.

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [linkErrorDesc, setLinkErrorDesc] = useState('');

  // Recovery del invalid-state
  const [retryEmail, setRetryEmail] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [retrySent, setRetrySent] = useState(false);
  const [retryError, setRetryError] = useState('');

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));

      const err = url.searchParams.get('error') || hashParams.get('error');
      const errDesc =
        url.searchParams.get('error_description') ||
        hashParams.get('error_description') ||
        '';

      if (err) {
        if (mounted) {
          setLinkErrorDesc(errDesc.replace(/\+/g, ' '));
          setReady('invalid');
        }
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
      const isSessionMissing = /session|expired|not_admin|jwt/i.test(upErr.message);
      if (isSessionMissing) {
        setReady('invalid');
        setLinkErrorDesc('El link de recuperación expiró o ya se usó.');
      } else {
        setError(upErr.message);
      }
      return;
    }
    router.push('/mis-cursos');
    router.refresh();
  };

  const sendNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetryError('');
    if (!retryEmail) {
      setRetryError('Ingresá tu email.');
      return;
    }
    setRetryLoading(true);
    try {
      const res = await fetch('/api/cursos/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: retryEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setRetryError(data?.error || 'No pudimos enviar el mail. Probá de nuevo.');
      } else {
        setRetrySent(true);
      }
    } catch {
      setRetryError('Error de red. Probá de nuevo.');
    }
    setRetryLoading(false);
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
          {ready === 'invalid' ? 'Pedí un link nuevo' : 'Setea tu contraseña'}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-cursos-ink-soft">
          {ready === 'invalid'
            ? 'El link anterior ya no sirve. Ingresá tu email y te mandamos uno nuevo al toque.'
            : 'Solo es la primera vez. Después entrás como siempre desde la página de login.'}
        </p>

        {ready === 'checking' && (
          <p className="mt-6 text-[13px] text-cursos-muted">Verificando el link…</p>
        )}

        {ready === 'invalid' && (
          <div className="mt-6 space-y-4">
            {!retrySent ? (
              <form onSubmit={sendNewLink} className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-cursos-muted">
                    Tu email
                  </span>
                  <input
                    type="email"
                    value={retryEmail}
                    onChange={(e) => setRetryEmail(e.target.value)}
                    placeholder="tu@email.com"
                    autoFocus
                    className={inputCls}
                  />
                </label>
                {retryError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                    {retryError}
                  </p>
                )}
                <LightButton type="submit" disabled={retryLoading} fullWidth size="lg">
                  {retryLoading ? 'Enviando…' : 'Enviarme un link nuevo'}
                </LightButton>
                {linkErrorDesc && (
                  <p className="text-[12px] text-cursos-muted">
                    Detalle técnico: {linkErrorDesc}
                  </p>
                )}
                <p className="text-center text-[12.5px] text-cursos-muted">
                  Tip: revisá tu casilla apenas te llegue y abrilo desde el celular sin esperar.
                </p>
              </form>
            ) : (
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-800">
                Listo. Te mandamos un mail con un link nuevo. <strong>Abrilo apenas te
                llegue</strong> — los links son de un solo uso y se vencen rápido.
              </div>
            )}
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

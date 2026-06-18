'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LightContainer from '@/components/cursos/ui/LightContainer';
import { createClient } from '@/lib/supabase/client';

// Confirma el OTP de recuperacion SOLO cuando el cliente clickea — no
// cuando el prefetcher del mail (Outlook/Gmail safety scan/iOS Mail
// preview) pasa por el link. Para que esto funcione, el template del
// email de "Reset Password" en Supabase tiene que apuntar a esta URL
// con ?token_hash={{ .TokenHash }}&type=recovery
//
// Es la unica forma robusta de evitar que los OTPs de Supabase se
// consuman antes de que el cliente los use. Una vez consumidos, el
// link devuelve "otp_expired" / "already used" y no hay vuelta atras.

export default function AuthConfirmPage() {
  const router = useRouter();
  const [state, setState] = useState<'verifying' | 'error'>('verifying');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get('token_hash');
      const type = (url.searchParams.get('type') || 'recovery') as
        | 'recovery'
        | 'email'
        | 'signup'
        | 'invite'
        | 'email_change';

      // En prod las URLs son /auth/...; en dev (localhost) son /cursos/auth/...
      // Derivamos el prefijo del pathname actual para que el redirect ande
      // en los dos entornos sin hardcodear.
      const prefix = window.location.pathname.startsWith('/cursos/') ? '/cursos' : '';
      const next = url.searchParams.get('next') || `${prefix}/auth/set-password`;
      const setPwd = `${prefix}/auth/set-password`;

      if (!tokenHash) {
        router.replace(`${setPwd}?error=missing_token`);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) {
        // Mostramos el error real y mandamos al set-password con el flag
        // para que el cliente pueda pedir uno nuevo desde ahi.
        const desc = encodeURIComponent(error.message);
        router.replace(`${setPwd}?error=${error.name || 'verify_failed'}&error_description=${desc}`);
        setErrMsg(error.message);
        setState('error');
        return;
      }
      router.replace(next);
    };
    run();
  }, [router]);

  return (
    <LightContainer size="narrow" className="py-16 sm:py-24">
      <div className="mx-auto max-w-md rounded-2xl border border-cursos-line bg-cursos-surface p-7 shadow-[var(--shadow-cursos-sm)] sm:p-9">
        <h1 className="text-2xl font-bold tracking-tight text-cursos-ink">
          {state === 'verifying' ? 'Verificando…' : 'Hubo un problema'}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-cursos-ink-soft">
          {state === 'verifying'
            ? 'Estamos confirmando tu link, dura un segundo.'
            : errMsg || 'No pudimos verificar el link.'}
        </p>
      </div>
    </LightContainer>
  );
}

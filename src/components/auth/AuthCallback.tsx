'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          router.push('/profile?reset=1');
        }
      }
    );

    // Also check hash on mount for recovery tokens
    if (window.location.hash.includes('type=recovery')) {
      // Supabase client will process the hash automatically
      // and fire PASSWORD_RECOVERY event above
    }

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}

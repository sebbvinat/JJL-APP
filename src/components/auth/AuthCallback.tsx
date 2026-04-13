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

    // Handle hash fragment tokens (recovery links land with #access_token=...)
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      // Supabase client auto-processes the hash and fires the appropriate event
      // Just make sure we stay on the page long enough for it to complete
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // Token was exchanged successfully — check if it's a recovery
          // The onAuthStateChange above will handle PASSWORD_RECOVERY
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}

'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/lib/supabase/types';
import type { User as AuthUser } from '@supabase/supabase-js';

interface UserContextValue {
  authUser: AuthUser | null;
  profile: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  authUser: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadUser(attempt = 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;

        // getUser() NO lanza excepción ante un fallo de red: devuelve
        // { user: null }. Sin reintento, una señal mala momentánea (o el
        // lock de auth trabado con la PWA y el navegador abiertos a la vez)
        // dejaba la sesión en null PARA SIEMPRE en el cliente, aunque el
        // server siguiera autenticando por cookie. De ahí salía el crash del
        // chat al enviar. Reintentamos con backoff antes de darla por perdida.
        if (!user && attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
          if (mounted) return loadUser(attempt + 1);
          return;
        }

        setAuthUser(user);

        if (user) {
          const { data } = await supabase
            .from('users')
            // REVERT: select('*') de vuelta. El select específico anterior
            // rompía si alguna columna (lifecycle_stage, started_at,
            // setter_guide_seen_at) no existía en una variante de la DB:
            // el query fallaba silenciosa y profile quedaba null →
            // /profile mostraba al admin como alumno blanco con 0 puntos.
            // El payload extra es ~2-3 KB, no vale el riesgo de inconsistencia.
            .select('*')
            .eq('id', user.id)
            .single();
          if (mounted) setProfile(data);
        }
      } catch (err) {
        console.error('UserProvider error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
          initialized.current = true;
        }
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || !initialized.current) return;

        if (event === 'SIGNED_OUT') {
          setAuthUser(null);
          setProfile(null);
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          const user = session?.user ?? null;
          setAuthUser(user);
          if (user) {
            const { data } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();
            if (mounted) setProfile(data);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <UserContext.Provider value={{ authUser, profile, loading, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

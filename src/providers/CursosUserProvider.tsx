'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User as AuthUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Contexto liviano de auth para el producto JJL Cursos. Independiente
// del UserProvider del programa (que carga campos del programa de 6 meses).
// Se monta solo en los layouts autenticados de Cursos (mis-cursos, visor).

interface CursosProfile {
  id: string;
  nombre: string;
  email: string | null;
  rol: string;
}

interface CursosUserContextValue {
  authUser: AuthUser | null;
  profile: CursosProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const CursosUserContext = createContext<CursosUserContextValue | null>(null);

export function CursosUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<CursosProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setAuthUser(user);
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('id, nombre, email, rol')
          .eq('id', user.id)
          .single();
        if (active) setProfile((data as unknown as CursosProfile) ?? null);
      }
      if (active) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthUser(null);
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);
    router.push('/');
    router.refresh();
  };

  return (
    <CursosUserContext.Provider value={{ authUser, profile, loading, signOut }}>
      {children}
    </CursosUserContext.Provider>
  );
}

export function useCursosUser(): CursosUserContextValue {
  const ctx = useContext(CursosUserContext);
  if (!ctx) {
    throw new Error('useCursosUser debe usarse dentro de <CursosUserProvider>');
  }
  return ctx;
}

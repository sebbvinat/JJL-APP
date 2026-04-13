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

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;

        setAuthUser(user);

        if (user) {
          const { data } = await supabase
            .from('users')
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

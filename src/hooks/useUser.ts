'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/lib/supabase/types';
import type { User as AuthUser } from '@supabase/supabase-js';

export function useUser() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Use onAuthStateChange as the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        const user = session?.user ?? null;
        setAuthUser(user);

        if (user) {
          try {
            const data = await fetchProfile(user.id);
            if (mounted) setProfile(data);
          } catch (err) {
            console.error('Profile fetch error:', err);
          }
        } else {
          setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    // Also do an initial getUser call as fallback
    // (onAuthStateChange INITIAL_SESSION can sometimes be slow)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      if (user) {
        setAuthUser(user);
        try {
          const data = await fetchProfile(user.id);
          if (mounted) setProfile(data);
        } catch (err) {
          console.error('Profile fetch error:', err);
        }
      }
      if (mounted) setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return { authUser, profile, loading, signOut };
}

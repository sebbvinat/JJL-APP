'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import ModuleCard from '@/components/modules/ModuleCard';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { MOCK_MODULES, MOCK_LESSONS } from '@/lib/mock-data';

export default function ModulesPage() {
  const { authUser, loading: userLoading } = useUser();
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!authUser) {
      setLoading(false);
      return;
    }

    async function fetchAccess() {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_access')
        .select('module_id')
        .eq('user_id', authUser!.id)
        .eq('is_unlocked', true);

      setUnlockedIds((data as { module_id: string }[] | null)?.map((row) => row.module_id) || []);
      setLoading(false);
    }

    fetchAccess();
  }, [authUser, userLoading]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Solo muestra módulos desbloqueados para este usuario
  const visibleModules = MOCK_MODULES.filter((mod) => unlockedIds.includes(mod.id));

  if (visibleModules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="h-20 w-20 bg-jjl-gray rounded-full flex items-center justify-center">
          <Lock className="h-10 w-10 text-jjl-muted" />
        </div>
        <h2 className="text-xl font-bold">Sin modulos disponibles</h2>
        <p className="text-jjl-muted max-w-sm">
          Tu instructor aun no ha habilitado modulos para tu cuenta.
          Contactalo para comenzar tu entrenamiento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Personalizado Atletico</h1>
        <p className="text-jjl-muted mt-1">6 meses de entrenamiento — 24 semanas + fundamentos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map((mod) => {
          const lessons = MOCK_LESSONS[mod.id] || [];
          const completedCount = lessons.filter((l) => l.completed).length;

          return (
            <ModuleCard
              key={mod.id}
              id={mod.id}
              semana={mod.semana_numero}
              titulo={mod.titulo}
              descripcion={mod.descripcion}
              totalLessons={lessons.length}
              completedLessons={completedCount}
              unlocked={true}
            />
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  setCoursePublished,
  setBundlePublished,
  createCourse,
} from './actions';

// Toggle de publicado para un curso o bundle.
export function PublishToggle({
  id,
  tipo,
  publicado,
}: {
  id: string;
  tipo: 'curso' | 'bundle';
  publicado: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const fn = tipo === 'curso' ? setCoursePublished : setBundlePublished;
      await fn(id, !publicado);
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold transition-colors disabled:opacity-50',
        publicado
          ? 'bg-success-soft text-green-400'
          : 'bg-white/5 text-jjl-muted'
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          publicado ? 'bg-green-400' : 'bg-jjl-muted'
        )}
      />
      {publicado ? 'Publicado' : 'Borrador'}
    </button>
  );
}

// Botón para crear un curso nuevo y saltar a su editor.
export function NewCourseButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const create = () =>
    start(async () => {
      setError('');
      const res = await createCourse();
      if (res.error || !res.id) {
        setError(res.error ?? 'Error al crear el curso');
        return;
      }
      router.push(`/admin-cursos/curso/${res.id}`);
    });

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-[13px] text-error">{error}</span>}
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="inline-flex h-10 items-center rounded-lg bg-jjl-red px-4 text-sm font-semibold text-white transition-colors hover:bg-jjl-red-hover disabled:opacity-50"
      >
        {pending ? 'Creando…' : '+ Nuevo curso'}
      </button>
    </div>
  );
}

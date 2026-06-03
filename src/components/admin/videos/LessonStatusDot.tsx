'use client';

import type { LessonStatus } from '@/lib/admin-videos';

const styles: Record<LessonStatus, { bg: string; ring: string; label: string }> = {
  has_video:  { bg: 'bg-green-500',  ring: 'ring-green-500/30',  label: 'Tiene video' },
  no_video:   { bg: 'bg-jjl-muted/30', ring: 'ring-white/10',     label: 'Sin video' },
  reflection: { bg: 'bg-purple-500/60', ring: 'ring-purple-500/20', label: 'Reflexión semanal (no tiene video)' },
};

export default function LessonStatusDot({ status }: { status: LessonStatus }) {
  const s = styles[status];
  return (
    <span
      title={s.label}
      className={`inline-block h-2.5 w-2.5 rounded-full ${s.bg} ring-2 ${s.ring} shrink-0`}
      aria-label={s.label}
    />
  );
}

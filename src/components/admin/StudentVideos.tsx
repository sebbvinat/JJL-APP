'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Video,
  Clock,
  CheckCircle,
  RotateCcw,
  ExternalLink,
  MessageSquare,
  Save,
  X,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { fetcher } from '@/lib/fetcher';
import { logger } from '@/lib/logger';

interface VideoRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  drive_url: string | null;
  status: 'pendiente' | 'revisado' | 'para_rehacer';
  feedback_texto: string | null;
  feedback_at: string | null;
  created_at: string;
}

const STATUS_META: Record<
  VideoRow['status'],
  { label: string; tone: string; icon: typeof Clock }
> = {
  pendiente: {
    label: 'Pendiente',
    tone: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    icon: Clock,
  },
  revisado: {
    label: 'Revisado',
    tone: 'bg-green-500/10 border-green-500/25 text-green-400',
    icon: CheckCircle,
  },
  para_rehacer: {
    label: 'Rehacer',
    tone: 'bg-red-500/10 border-red-500/25 text-red-400',
    icon: RotateCcw,
  },
};

export default function StudentVideos({ userId }: { userId: string }) {
  const key = `/api/videos?user=${userId}`;
  const { data, isLoading } = useSWR<{ videos: VideoRow[] }>(key, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState<'revisado' | 'para_rehacer' | null>(
    null
  );

  const videos = data?.videos || [];
  const pending = videos.filter((v) => v.status === 'pendiente');
  const reviewed = videos.filter((v) => v.status !== 'pendiente');

  function startReview(v: VideoRow) {
    setReviewingId(v.id);
    setFeedbackText(v.feedback_texto || '');
  }

  function cancelReview() {
    setReviewingId(null);
    setFeedbackText('');
  }

  async function submit(id: string, status: 'revisado' | 'para_rehacer') {
    setSubmitting(status);
    try {
      const res = await fetch(`/api/videos/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, feedback: feedbackText.trim() }),
      });
      if (res.ok) {
        toast.success(
          status === 'revisado' ? 'Marcado como revisado' : 'Marcado para rehacer'
        );
        mutate(key);
        cancelReview();
      } else {
        const body = await res.json();
        toast.error(body.error || 'No pudimos guardar');
      }
    } catch (err) {
      logger.error('admin.video.review.failed', { err });
      toast.error('Error de conexion');
    }
    setSubmitting(null);
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={Video}
        title="Sin videos"
        description="Este alumno todavia no subio ningun video."
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Pendientes ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((v) => (
              <VideoReviewCard
                key={v.id}
                video={v}
                isReviewing={reviewingId === v.id}
                feedbackText={feedbackText}
                submitting={submitting}
                onStartReview={() => startReview(v)}
                onCancelReview={cancelReview}
                onFeedbackChange={setFeedbackText}
                onSubmit={(status) => submit(v.id, status)}
              />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            Revisados ({reviewed.length})
          </h3>
          <div className="space-y-2">
            {reviewed.map((v) => (
              <VideoReviewCard
                key={v.id}
                video={v}
                isReviewing={reviewingId === v.id}
                feedbackText={feedbackText}
                submitting={submitting}
                onStartReview={() => startReview(v)}
                onCancelReview={cancelReview}
                onFeedbackChange={setFeedbackText}
                onSubmit={(status) => submit(v.id, status)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VideoReviewCard({
  video,
  isReviewing,
  feedbackText,
  submitting,
  onStartReview,
  onCancelReview,
  onFeedbackChange,
  onSubmit,
}: {
  video: VideoRow;
  isReviewing: boolean;
  feedbackText: string;
  submitting: 'revisado' | 'para_rehacer' | null;
  onStartReview: () => void;
  onCancelReview: () => void;
  onFeedbackChange: (v: string) => void;
  onSubmit: (status: 'revisado' | 'para_rehacer') => void;
}) {
  const meta = STATUS_META[video.status];
  const Icon = meta.icon;
  const uploadedAgo = formatDistanceToNow(parseISO(video.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${meta.tone}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-white truncate">
              {video.titulo}
            </span>
            <span
              className={`inline-flex items-center h-5 px-1.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
            >
              {meta.label}
            </span>
          </div>
          <p className="text-[11px] text-jjl-muted mt-0.5">
            Subido {uploadedAgo}
            {video.feedback_at && (
              <>
                {' '}
                · Revisado{' '}
                {formatDistanceToNow(parseISO(video.feedback_at), {
                  addSuffix: true,
                  locale: es,
                })}
              </>
            )}
          </p>
          {video.descripcion && (
            <p className="text-[12px] text-jjl-muted/80 mt-1.5 whitespace-pre-wrap leading-relaxed">
              {video.descripcion}
            </p>
          )}

          {/* Existing feedback (when not actively editing) */}
          {!isReviewing && video.feedback_texto && (
            <div className="mt-3 p-3 rounded-lg bg-black/30 border-l-2 border-jjl-red">
              <p className="text-[10px] uppercase tracking-wider text-jjl-red font-bold mb-1">
                Tu feedback
              </p>
              <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">
                {video.feedback_texto}
              </p>
            </div>
          )}

          {/* Review form */}
          {isReviewing && (
            <div className="mt-3 space-y-2.5 p-3 rounded-lg bg-white/[0.03] border border-jjl-border animate-slide-down">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-jjl-muted font-bold mb-1.5">
                  Feedback al alumno
                </span>
                <textarea
                  value={feedbackText}
                  onChange={(e) => onFeedbackChange(e.target.value)}
                  rows={3}
                  placeholder="Te falta timing en el pase al minuto 2:15. Probá bajar el codo antes de pasar."
                  className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none"
                />
              </label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onSubmit('revisado')}
                  loading={submitting === 'revisado'}
                >
                  <Save className="h-3.5 w-3.5" />
                  Marcar revisado
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onSubmit('para_rehacer')}
                  loading={submitting === 'para_rehacer'}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Pedir rehacer
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelReview}>
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isReviewing && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {video.drive_url && (
                <a
                  href={video.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-jjl-red hover:text-jjl-red-hover font-semibold"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir en Drive
                </a>
              )}
              <button
                onClick={onStartReview}
                className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white font-semibold"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {video.feedback_texto ? 'Editar feedback' : 'Revisar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle,
  ExternalLink,
  Upload as UploadIcon,
  Clock,
  RotateCcw,
  Video,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import UploadDropzone from '@/components/upload/UploadDropzone';
import { useToast } from '@/components/ui/Toast';
import { fetcher } from '@/lib/fetcher';
import { logger } from '@/lib/logger';

type Tab = 'subir' | 'mis-videos';

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
    label: 'En revision',
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

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>('subir');

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
          <UploadIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Videos</h1>
          <p className="text-sm text-jjl-muted mt-0.5">
            Subi videos para que tu instructor los revise.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-jjl-border rounded-xl p-1 w-fit">
        {[
          { key: 'subir', label: 'Subir', icon: UploadIcon },
          { key: 'mis-videos', label: 'Mis videos', icon: Video },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`inline-flex items-center gap-2 px-3.5 h-9 rounded-lg text-[13px] font-semibold transition-all ${
                active
                  ? 'bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'text-jjl-muted hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.9} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'subir' ? <UploadTab onUploaded={() => setTab('mis-videos')} /> : <MyVideosTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload tab
// ---------------------------------------------------------------------------

function UploadTab({ onUploaded }: { onUploaded: () => void }) {
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function getFolder() {
      try {
        const res = await fetch('/api/upload/folder');
        const data = await res.json();
        if (res.ok && data.folderUrl) {
          setFolderUrl(data.folderUrl);
        } else {
          setError(data.error || 'Error al obtener carpeta');
        }
      } catch {
        setError('Error de conexion');
      }
      setLoading(false);
    }
    getFolder();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-jjl-gray-light/50 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-8 space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <Button onClick={() => window.location.reload()} variant="secondary" size="sm">
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-center py-8 space-y-5">
        <div className="h-20 w-20 bg-jjl-red/15 rounded-full flex items-center justify-center mx-auto">
          <UploadIcon className="h-10 w-10 text-jjl-red" />
        </div>
        <div className="space-y-2 max-w-sm mx-auto">
          <h2 className="text-xl font-bold">Subi tu lucha</h2>
          <p className="text-sm text-jjl-muted">
            Tenes una carpeta privada en Google Drive. Subi tus videos ahi y tu instructor los va a revisar.
          </p>
        </div>
        {folderUrl && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-jjl-red text-white font-semibold rounded-xl hover:bg-jjl-red-hover transition-colors shadow-lg shadow-jjl-red/20"
          >
            <ExternalLink className="h-5 w-5" />
            Abrir mi carpeta en Drive
          </a>
        )}
        <p className="text-xs text-jjl-muted">
          Podes subir videos de hasta 2GB. Formatos: MP4, MOV, AVI.
        </p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mis videos tab
// ---------------------------------------------------------------------------

function MyVideosTab() {
  const { data, isLoading } = useSWR<{ videos: VideoRow[] }>(
    '/api/videos',
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 30_000 }
  );
  const videos = data?.videos || [];

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
        title="No subiste videos todavia"
        description="Subi tu primer video y tu instructor lo va a revisar."
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}

function VideoCard({ video }: { video: VideoRow }) {
  const meta = STATUS_META[video.status];
  const Icon = meta.icon;
  const uploadedAgo = formatDistanceToNow(parseISO(video.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <Card className="group">
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

          {video.feedback_texto && (
            <div className="mt-3 p-3 rounded-lg bg-black/30 border-l-2 border-jjl-red">
              <p className="text-[10px] uppercase tracking-wider text-jjl-red font-bold mb-1">
                Feedback del instructor
              </p>
              <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">
                {video.feedback_texto}
              </p>
            </div>
          )}

          {video.drive_url && (
            <a
              href={video.drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-jjl-red hover:text-jjl-red-hover font-semibold mt-3"
            >
              <ExternalLink className="h-3 w-3" />
              Ver en Drive
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

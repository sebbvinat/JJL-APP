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
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ fileName: string; webViewLink: string } | null>(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!uploading) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) {
          clearInterval(interval);
          return 95;
        }
        return p + Math.random() * 15;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [uploading]);

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('titulo', titulo);
      formData.append('descripcion', descripcion);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const text = await res.text();
      let data: { fileName?: string; webViewLink?: string; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 413
            ? 'El archivo es demasiado grande. Limite: 500MB'
            : text || 'Error al subir'
        );
      }

      if (!res.ok) throw new Error(data.error || 'Error al subir');

      setProgress(100);
      setTimeout(() => {
        setResult({ fileName: data.fileName ?? '', webViewLink: data.webViewLink ?? '' });
        setUploading(false);
        toast.success('Video subido', 'En revision por tu instructor');
        mutate('/api/videos');
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir el archivo';
      setError(msg);
      setUploading(false);
      setProgress(0);
      logger.error('upload.failed', { err, fileName: file.name, size: file.size });
      toast.error(msg, 'Upload fallo');
    }
  };

  const reset = () => {
    setFile(null);
    setTitulo('');
    setDescripcion('');
    setResult(null);
    setProgress(0);
    setError('');
  };

  if (result) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-5 animate-fade-in">
        <div className="h-20 w-20 bg-green-500/15 rounded-full flex items-center justify-center shadow-lg shadow-green-500/10 animate-scale-in">
          <CheckCircle className="h-10 w-10 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-white">Video en revision</h2>
          <p className="text-[13px] text-jjl-muted">
            Se subio correctamente. Tu instructor lo va a revisar y te va a dejar
            una nota en &quot;Mis videos&quot;.
          </p>
        </div>
        {result.webViewLink && result.webViewLink !== '#' && (
          <a
            href={result.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-jjl-red hover:text-red-400 hover:underline text-sm transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir en Google Drive
          </a>
        )}
        <div className="flex gap-2">
          <Button onClick={reset} variant="secondary">
            Subir otro
          </Button>
          <Button onClick={onUploaded}>Ver mis videos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <UploadDropzone file={file} onFileSelect={setFile} />
      </Card>

      {file && (
        <>
          <Card>
            <div className="space-y-4">
              <Input
                id="titulo"
                label="Titulo del video"
                placeholder="Ej: Lucha en torneo local — semifinal"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
                  Descripcion (opcional)
                </span>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none h-24"
                  placeholder="Contexto: torneo, sparring, tecnica que intentaste..."
                />
              </label>
            </div>
          </Card>

          {uploading && (
            <Card>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-jjl-muted">Subiendo a Google Drive...</span>
                  <span className="text-jjl-red font-bold tabular-nums">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-jjl-red to-orange-500 rounded-full transition-all duration-300 shadow-[0_0_12px_-2px_rgba(220,38,38,0.6)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-start gap-2 animate-fade-in">
              <div className="h-4 w-4 rounded-full bg-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-red-300 text-[10px] font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <Button
            size="lg"
            fullWidth
            onClick={handleUpload}
            loading={uploading}
            disabled={uploading}
          >
            Subir video
          </Button>
        </>
      )}
    </div>
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

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
    <div className="space-y-5 max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto pb-12">
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

// Resumable upload directo a Drive con barra de progreso (XHR — fetch no
// expone progreso del upload). Devuelve el fileId de Drive cuando completa.
function uploadResumable(file: File, uploadUrl: string, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const meta = JSON.parse(xhr.responseText);
          if (meta?.id) resolve(meta.id);
          else reject(new Error('Drive no devolvió fileId'));
        } catch {
          reject(new Error('Respuesta inesperada de Drive'));
        }
      } else {
        reject(new Error(`Drive PUT falló (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Error de red al subir a Drive'));
    xhr.send(file);
  });
}

function UploadTab({ onUploaded }: { onUploaded: () => void }) {
  const [folderUrl, setFolderUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const toast = useToast();

  // Folder fallback link (para casos de archivo enorme o conexion mala).
  useEffect(() => {
    fetch('/api/upload/folder')
      .then((r) => r.json())
      .then((d) => { if (d?.folderUrl) setFolderUrl(d.folderUrl); })
      .catch(() => {});
  }, []);

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    setErrorMsg(null);
    try {
      // 1. Pedir URL de sesión resumable a Drive
      const sessRes = await fetch('/api/upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'video/mp4',
          fileSize: file.size,
        }),
      });
      const sess = await sessRes.json();
      if (!sessRes.ok || !sess?.uploadUrl) {
        throw new Error(sess?.error || 'No se pudo iniciar la subida');
      }

      // 2. PUT el archivo directo a Drive (browser -> Drive, no pasa por
      //    nuestros servers; bypasses limit de Vercel).
      const fileId = await uploadResumable(file, sess.uploadUrl, setProgress);

      // 3. Confirmar en nuestra DB -> dispara notif a admins (tag profesor)
      const confRes = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          titulo: titulo.trim() || file.name,
          descripcion: descripcion.trim() || null,
          fileSize: file.size,
        }),
      });
      const conf = await confRes.json();
      if (!confRes.ok) throw new Error(conf?.error || 'Error al confirmar');

      toast.success('¡Video subido! Tu instructor ya fue notificado.');
      setFile(null);
      setTitulo('');
      setDescripcion('');
      setProgress(0);
      onUploaded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al subir';
      setErrorMsg(msg);
      toast.error(msg);
      logger.error('upload.failed', { err: msg });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <div className="space-y-4">
        <UploadDropzone file={file} onFileSelect={(f) => { setFile(f); setErrorMsg(null); }} />

        {file && (
          <>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (opcional — si dejás vacío usa el nombre del archivo)"
              disabled={uploading}
              maxLength={200}
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción / contexto (opcional)"
              rows={2}
              disabled={uploading}
              maxLength={1000}
              className="w-full bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25 resize-none disabled:opacity-50"
            />

            {uploading && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-jjl-muted mb-1.5">
                  <span>Subiendo a Drive…</span>
                  <span className="font-semibold tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-jjl-red transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                {errorMsg}
              </p>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              loading={uploading}
              className="w-full"
            >
              <UploadIcon className="h-4 w-4" />
              {uploading ? `Subiendo… ${progress}%` : 'Subir video'}
            </Button>
          </>
        )}

        {folderUrl && (
          <p className="text-[11px] text-jjl-muted/80 text-center pt-3 border-t border-jjl-border/40">
            Archivo más de 2GB o subida fallando?{' '}
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-jjl-red hover:text-jjl-red-hover font-semibold inline-flex items-center gap-1"
            >
              Abrí tu carpeta de Drive <ExternalLink className="h-3 w-3" />
            </a>
            {' '}y subí desde ahí (igual lo sincronizamos 1×/día).
          </p>
        )}
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

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Video, ExternalLink, CheckCircle, RotateCcw, Clock, Send, MessageSquare,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface VideoRow {
  id: string;
  user_id: string;
  titulo: string;
  descripcion: string | null;
  drive_url: string | null;
  drive_file_id: string | null;
  status: 'pendiente' | 'revisado' | 'para_rehacer';
  feedback_texto: string | null;
  feedback_at: string | null;
  created_at: string;
  users?: { nombre: string; avatar_url: string | null } | null;
}

type Filter = 'pendiente' | 'revisado' | 'para_rehacer' | 'todos';

export default function ReviewsPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pendiente');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [scanDetails, setScanDetails] = useState<any[]>([]);
  const [showScanDetails, setShowScanDetails] = useState(false);

  useEffect(() => {
    // Auto-sync drive videos then load
    (async () => {
      await handleSync(true);
      await loadVideos();
    })();
  }, []);

  async function loadVideos() {
    try {
      const res = await fetch('/api/videos?all=1');
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch {}
    setLoading(false);
  }

  async function handleSync(silent = false) {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/sync-drive-videos', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        if (!silent) {
          setSyncMsg(`Error: ${data.error || 'No se pudo sincronizar'}`);
          setTimeout(() => setSyncMsg(''), 5000);
        }
        console.error('[sync] failed', data);
        setSyncing(false);
        return;
      }

      console.log('[sync] result', data);
      setScanDetails(data.scanDetails || []);

      if (!silent) {
        if (data.imported > 0) {
          setSyncMsg(`${data.imported} video${data.imported !== 1 ? 's' : ''} nuevo${data.imported !== 1 ? 's' : ''} importado${data.imported !== 1 ? 's' : ''}`);
        } else if (data.studentsWithFolder === 0 || (data.studentsScanned === 0)) {
          setSyncMsg(data.message || 'No hay alumnos con carpeta');
        } else {
          const totalFiles = (data.scanDetails || []).reduce((s: number, d: any) => s + d.totalFiles, 0);
          setSyncMsg(totalFiles > 0 ? `Todo al dia (${totalFiles} ya en app)` : `Sin videos en las ${data.studentsScanned} carpetas`);
        }
        setTimeout(() => setSyncMsg(''), 5000);
      }

      if (data.imported > 0) await loadVideos();
    } catch (err) {
      console.error('[sync] exception', err);
      if (!silent) {
        setSyncMsg('Error de conexion');
        setTimeout(() => setSyncMsg(''), 4000);
      }
    }
    setSyncing(false);
  }

  async function handleReview(videoId: string, status: 'revisado' | 'para_rehacer') {
    if (!feedback.trim() && status === 'para_rehacer') {
      alert('Agregale feedback para que el alumno sepa que mejorar');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, feedback: feedback.trim() }),
      });
      if (res.ok) {
        setActiveId(null);
        setFeedback('');
        loadVideos();
      }
    } catch {}
    setSaving(false);
  }

  const filtered = filter === 'todos'
    ? videos
    : videos.filter((v) => v.status === filter);

  const pendingCount = videos.filter((v) => v.status === 'pendiente').length;

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto animate-pulse">
        <div className="h-12 bg-jjl-gray-light/50 rounded-xl" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-jjl-gray-light/50 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Revisar Videos</h1>
          <p className="text-jjl-muted text-sm mt-1">
            {syncing ? 'Sincronizando con Drive...' : syncMsg || (pendingCount > 0 ? `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} de revisar` : 'Todos revisados')}
          </p>
        </div>
        <button
          onClick={() => handleSync(false)}
          disabled={syncing}
          className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-xs font-semibold hover:bg-jjl-border disabled:opacity-50"
        >
          {syncing ? 'Sincronizando...' : 'Sincronizar Drive'}
        </button>
      </div>

      {/* Scan details - shows which folders were checked */}
      {scanDetails.length > 0 && (
        <Card>
          <button
            onClick={() => setShowScanDetails(!showScanDetails)}
            className="w-full flex items-center justify-between"
          >
            <span className="text-sm font-semibold">
              Carpetas escaneadas ({scanDetails.length})
            </span>
            <span className="text-xs text-jjl-muted">
              {showScanDetails ? 'Ocultar' : 'Ver detalle'}
            </span>
          </button>
          {showScanDetails && (
            <div className="mt-3 space-y-2">
              {scanDetails.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm bg-jjl-gray-light/30 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{d.nombre}</p>
                    <a
                      href={`https://drive.google.com/drive/folders/${d.folderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:underline truncate block"
                    >
                      {d.folderId} ↗
                    </a>
                    {d.error && (
                      <p className="text-[10px] text-red-400 mt-1">Error: {d.error}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs text-jjl-muted">
                      <span className="text-white font-bold">{d.totalFiles}</span> videos
                    </p>
                    {d.newFiles > 0 && (
                      <p className="text-[10px] text-green-400">+{d.newFiles} nuevos</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-jjl-gray-light/50 rounded-xl p-1 overflow-x-auto">
        {([
          { key: 'pendiente', label: 'Pendientes', count: videos.filter((v) => v.status === 'pendiente').length },
          { key: 'revisado', label: 'Revisados', count: videos.filter((v) => v.status === 'revisado').length },
          { key: 'para_rehacer', label: 'Para rehacer', count: videos.filter((v) => v.status === 'para_rehacer').length },
          { key: 'todos', label: 'Todos', count: videos.length },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              filter === opt.key ? 'bg-jjl-red text-white shadow-lg' : 'text-jjl-muted hover:text-white'
            }`}
          >
            {opt.label} <span className="opacity-60">({opt.count})</span>
          </button>
        ))}
      </div>

      {/* Videos list */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Video className="h-12 w-12 text-jjl-muted mx-auto mb-3" />
            <p className="text-jjl-muted">No hay videos {filter !== 'todos' ? filter : ''}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const isActive = activeId === v.id;
            return (
              <Card key={v.id}>
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <Avatar src={v.users?.avatar_url} name={v.users?.nombre || 'Alumno'} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{v.users?.nombre || 'Alumno'}</p>
                      <p className="text-xs text-jjl-muted">
                        {format(new Date(v.created_at), "d 'de' MMM · HH:mm", { locale: es })}
                      </p>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>

                  {/* Video info */}
                  <div>
                    <h3 className="font-bold">{v.titulo}</h3>
                    {v.descripcion && (
                      <p className="text-sm text-jjl-muted mt-1 whitespace-pre-wrap">{v.descripcion}</p>
                    )}
                  </div>

                  {/* Drive link */}
                  {v.drive_url && (
                    <a
                      href={v.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
                    >
                      <Video className="h-4 w-4" />
                      Ver video en Drive
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Existing feedback */}
                  {v.feedback_texto && (
                    <div className="bg-jjl-gray-light/50 border-l-2 border-jjl-red rounded-r-lg px-3 py-2">
                      <p className="text-[11px] text-jjl-muted uppercase tracking-wider mb-1 font-semibold">Feedback enviado</p>
                      <p className="text-sm text-white whitespace-pre-wrap">{v.feedback_texto}</p>
                    </div>
                  )}

                  {/* Review form */}
                  {isActive ? (
                    <div className="space-y-3 pt-3 border-t border-jjl-border">
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Dejale feedback al alumno..."
                        rows={3}
                        className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-3 py-3 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="primary" onClick={() => handleReview(v.id, 'revisado')} loading={saving}>
                          <CheckCircle className="h-4 w-4 mr-1.5" /> Marcar revisado
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleReview(v.id, 'para_rehacer')} loading={saving}>
                          <RotateCcw className="h-4 w-4 mr-1.5" /> Pedir rehacer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setActiveId(null); setFeedback(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap pt-2">
                      <Button size="sm" variant="primary" onClick={() => { setActiveId(v.id); setFeedback(v.feedback_texto || ''); }}>
                        <Send className="h-4 w-4 mr-1.5" /> {v.feedback_texto ? 'Editar feedback' : 'Dejar feedback'}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pendiente') return <Badge variant="warning">Pendiente</Badge>;
  if (status === 'revisado') return <Badge variant="success">Revisado</Badge>;
  if (status === 'para_rehacer') return <Badge variant="error">Rehacer</Badge>;
  return <Badge>{status}</Badge>;
}

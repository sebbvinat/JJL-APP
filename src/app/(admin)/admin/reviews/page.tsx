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
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [unlinkedStudents, setUnlinkedStudents] = useState<Array<{ id: string; nombre: string }>>([]);
  const [autoLinked, setAutoLinked] = useState<Array<{ nombre: string; folderId: string }>>([]);
  // Manual folder linking (for students whose folder Drive sync can't find)
  const [linkFolderUrl, setLinkFolderUrl] = useState('');
  const [linkUserId, setLinkUserId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  // Manual import (rescue when Drive doesn't return the file)
  const [showManual, setShowManual] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualUserId, setManualUserId] = useState('');
  const [manualMsg, setManualMsg] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; nombre: string }>>([]);

  useEffect(() => {
    // Pre-load students for the manual-import dropdown
    fetch('/api/admin/students').then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.students) {
        setStudents(d.students.map((s: any) => ({ id: s.id, nombre: s.nombre })));
      }
    }).catch(() => {});
  }, []);

  async function handleLinkFolder() {
    if (!linkFolderUrl.trim() || !linkUserId) {
      setLinkMsg('Faltan datos');
      return;
    }
    setLinkSaving(true);
    setLinkMsg('');
    try {
      const res = await fetch('/api/admin/link-drive-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderIdOrUrl: linkFolderUrl.trim(), userId: linkUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkMsg('✓ Vinculado');
        setLinkFolderUrl('');
        setLinkUserId('');
        // Re-run sync to scan the just-linked folder
        await handleSync(true);
        await loadVideos();
        setTimeout(() => setLinkMsg(''), 1500);
      } else {
        setLinkMsg(data.error || 'Error');
      }
    } catch {
      setLinkMsg('Error de conexion');
    }
    setLinkSaving(false);
  }

  async function handleManualImport() {
    if (!manualUrl.trim() || !manualUserId) {
      setManualMsg('Faltan datos');
      return;
    }
    setManualSaving(true);
    setManualMsg('');
    try {
      const res = await fetch('/api/admin/import-drive-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIdOrUrl: manualUrl.trim(), userId: manualUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setManualMsg('✓ Importado');
        setManualUrl('');
        await loadVideos();
        setTimeout(() => { setManualMsg(''); setShowManual(false); }, 1500);
      } else {
        setManualMsg(data.error || 'Error');
      }
    } catch {
      setManualMsg('Error de conexion');
    }
    setManualSaving(false);
  }


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
      setSyncErrors(data.errors || []);
      setUnlinkedStudents(data.unlinkedStudents || []);
      setAutoLinked(data.autoLinked || []);

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

      {/* Sync errors */}
      {syncErrors.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5">
          <p className="text-sm font-semibold text-red-400 mb-2">
            Errores al importar ({syncErrors.length})
          </p>
          <ul className="space-y-1 text-xs text-red-300">
            {syncErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Card>
      )}

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
                <div key={i} className="text-sm bg-jjl-gray-light/30 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
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
                        <span className="text-white font-bold">{d.totalFiles}</span> en Drive
                      </p>
                      {d.newFiles > 0 && (
                        <p className="text-[10px] text-green-400">+{d.newFiles} nuevos</p>
                      )}
                      {d.skippedFiles > 0 && (
                        <p className="text-[10px] text-jjl-muted">{d.skippedFiles} ya importados</p>
                      )}
                    </div>
                  </div>
                  {/* Show actual file names so it's obvious WHICH files Drive
                      returned. Helps diagnose why a video isn't appearing. */}
                  {Array.isArray(d.fileNames) && d.fileNames.length > 0 && (
                    <div className="border-t border-jjl-border/40 pt-1.5">
                      <p className="text-[10px] text-green-400 mb-1">Importados ahora:</p>
                      <ul className="text-[11px] text-white/80 space-y-0.5">
                        {d.fileNames.map((n: string, j: number) => (
                          <li key={j} className="truncate">• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(d.skippedNames) && d.skippedNames.length > 0 && d.skippedNames.length <= 5 && (
                    <div className="border-t border-jjl-border/40 pt-1.5">
                      <p className="text-[10px] text-jjl-muted mb-1">Ya estaban:</p>
                      <ul className="text-[11px] text-jjl-muted/80 space-y-0.5">
                        {d.skippedNames.map((n: string, j: number) => (
                          <li key={j} className="truncate">• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Surface non-video files so admin sees if Drive returned
                      something the filter is discarding (wrong extension,
                      shortcut, etc). */}
                  {Array.isArray(d.nonVideoNames) && d.nonVideoNames.length > 0 && (
                    <div className="border-t border-jjl-border/40 pt-1.5">
                      <p className="text-[10px] text-amber-400 mb-1">Archivos no-video en la carpeta:</p>
                      <ul className="text-[11px] text-amber-200/90 space-y-0.5">
                        {d.nonVideoNames.map((n: string, j: number) => (
                          <li key={j} className="truncate">• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(d.subfolderNames) && d.subfolderNames.length > 0 && (
                    <div className="border-t border-jjl-border/40 pt-1.5">
                      <p className="text-[10px] text-blue-400 mb-1">Subcarpetas dentro (no escaneadas):</p>
                      <ul className="text-[11px] text-blue-200/90 space-y-0.5">
                        {d.subfolderNames.map((n: string, j: number) => (
                          <li key={j} className="truncate">• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.rawTotal === 0 && d.totalFiles === 0 && !d.error && (
                    <div className="border-t border-jjl-border/40 pt-1.5 space-y-1">
                      <p className="text-[10px] text-amber-400">
                        Drive devolvio 0 archivos. Causas tipicas:
                      </p>
                      <ul className="text-[10px] text-amber-200/90 space-y-0.5 ml-2">
                        <li>• El alumno no subio nada en esta carpeta especifica.</li>
                        <li>• Subio el video pero a un Drive personal (no compartio con la cuenta de servicio).</li>
                        <li>• Hay subcarpetas y subio el video adentro de una.</li>
                      </ul>
                      <p className="text-[10px] text-jjl-muted">
                        Solucion rapida: pedile el link del video al alumno y usalo en "Importar manualmente" abajo.
                      </p>
                    </div>
                  )}
                  {d.rawTotal > 0 && d.totalFiles === 0 && !d.error && (
                    <p className="text-[10px] text-amber-400 border-t border-jjl-border/40 pt-1.5">
                      Drive devolvio {d.rawTotal} archivo{d.rawTotal !== 1 ? 's' : ''} pero ninguno paso el filtro de video.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Auto-linked folders summary */}
      {autoLinked.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <p className="text-sm font-semibold text-green-300">
            Carpetas vinculadas automaticamente por nombre
          </p>
          <ul className="mt-2 space-y-0.5 text-[12px] text-green-200/90">
            {autoLinked.map((a, i) => (
              <li key={i}>• {a.nombre}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Students without a Drive folder — admin can link one manually */}
      {unlinkedStudents.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-300 mb-2">
            Alumnos sin carpeta vinculada ({unlinkedStudents.length})
          </p>
          <p className="text-[11px] text-amber-200/80 mb-3">
            Estos alumnos no tienen una carpeta de Drive asociada. Si vos ya tenes su carpeta en tu Drive, vinculala aca pegando el link y eligiendo el alumno.
          </p>
          <ul className="text-[11px] text-amber-200/90 space-y-0.5 mb-3">
            {unlinkedStudents.slice(0, 12).map((s) => (
              <li key={s.id}>• {s.nombre}</li>
            ))}
            {unlinkedStudents.length > 12 && (
              <li className="text-jjl-muted">... y {unlinkedStudents.length - 12} mas</li>
            )}
          </ul>
          <div className="space-y-2">
            <input
              type="text"
              value={linkFolderUrl}
              onChange={(e) => setLinkFolderUrl(e.target.value)}
              placeholder="Link de la carpeta de Drive"
              className="w-full bg-jjl-gray-light/50 border border-jjl-border rounded-lg px-3 py-2 text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:border-jjl-red"
            />
            <select
              value={linkUserId}
              onChange={(e) => setLinkUserId(e.target.value)}
              className="w-full bg-jjl-gray-light/50 border border-jjl-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-jjl-red"
            >
              <option value="">Seleccionar alumno...</option>
              {unlinkedStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Button onClick={handleLinkFolder} loading={linkSaving} disabled={!linkFolderUrl.trim() || !linkUserId} size="sm">
                Vincular carpeta
              </Button>
              {linkMsg && <span className="text-xs text-jjl-muted">{linkMsg}</span>}
            </div>
          </div>
        </Card>
      )}

      {/* Manual import — for videos Drive sync can't see */}
      <Card>
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full flex items-center justify-between"
        >
          <span className="text-sm font-semibold">Importar video manualmente</span>
          <span className="text-xs text-jjl-muted">{showManual ? 'Cerrar' : 'Pegar link de Drive'}</span>
        </button>
        {showManual && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="Link o ID del video en Drive"
              className="w-full bg-jjl-gray-light/50 border border-jjl-border rounded-lg px-3 py-2 text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:border-jjl-red"
            />
            <select
              value={manualUserId}
              onChange={(e) => setManualUserId(e.target.value)}
              className="w-full bg-jjl-gray-light/50 border border-jjl-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-jjl-red"
            >
              <option value="">Seleccionar alumno...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Button onClick={handleManualImport} loading={manualSaving} disabled={!manualUrl.trim() || !manualUserId} size="sm">
                Importar
              </Button>
              {manualMsg && <span className="text-xs text-jjl-muted">{manualMsg}</span>}
            </div>
            <p className="text-[10px] text-jjl-muted">
              Si el alumno subio el video a su propio Drive, primero pedile que lo comparta con la cuenta de servicio (rol Lector basta).
            </p>
          </div>
        )}
      </Card>

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

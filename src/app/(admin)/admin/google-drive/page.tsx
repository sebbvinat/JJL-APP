'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle, Cloud, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Status = {
  configured: boolean;
  has_client_id: boolean;
  has_client_secret: boolean;
  connected: boolean;
  email: string | null;
  connected_at: string | null;
};

export default function AdminGoogleDrivePage() {
  const sp = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/google-oauth/status', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const connected = sp.get('connected');
    const error = sp.get('error');
    if (connected) toast.success('Google Drive conectado correctamente');
    if (error) toast.error(`Error de conexión: ${error}`);
  }, [sp, toast]);

  async function disconnect() {
    if (!confirm('¿Desconectar Google Drive? Las subidas in-app van a volver a fallar hasta que reconectes.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/google-oauth/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Error');
      toast.success('Desconectado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally { setDisconnecting(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] text-jjl-muted hover:text-white mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al panel
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold">Admin · Integración</p>
          <h1 className="text-2xl font-black tracking-tight">Google Drive</h1>
          <p className="text-sm text-jjl-muted mt-0.5">Conectá una cuenta de Google para que las subidas in-app usen su cuota.</p>
        </div>
      </div>

      {/* Por qué */}
      <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-4 text-[13px] text-jjl-muted space-y-2">
        <p className="text-white font-semibold">Por qué hace falta:</p>
        <p>Los service accounts de Google no tienen cuota de Drive propia (0 bytes). Si suben un archivo, queda a su nombre y Drive devuelve <b className="text-amber-400">403 storage</b>. Para evitarlo sin pagar Workspace, autorizá una cuenta real (ej. <code className="text-jjl-red">sebastianvinat@gmail.com</code>). Las subidas pasan a estar a nombre de esa cuenta y usan su 15 GB gratis (o más si tenés Google One).</p>
      </div>

      {/* Status */}
      <div className="rounded-xl border border-jjl-border bg-white/[0.02] p-5">
        {loading || !status ? (
          <p className="text-[13px] text-jjl-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando estado…</p>
        ) : !status.configured ? (
          <div className="space-y-3">
            <p className="text-[13px] text-amber-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Faltan env vars en Vercel:</p>
            <ul className="text-[12px] text-jjl-muted space-y-1 ml-6 list-disc">
              {!status.has_client_id && <li><code className="text-jjl-red">GOOGLE_OAUTH_CLIENT_ID</code> no configurado</li>}
              {!status.has_client_secret && <li><code className="text-jjl-red">GOOGLE_OAUTH_CLIENT_SECRET</code> no configurado</li>}
            </ul>
            <SetupGuide />
          </div>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <span className="text-[14px] font-semibold text-white">Conectado</span>
            </div>
            <div className="text-[12px] text-jjl-muted">
              <p>Cuenta: <b className="text-white">{status.email || '(sin email)'}</b></p>
              {status.connected_at && <p>Conectado: {new Date(status.connected_at).toLocaleString('es-AR')}</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <a href="/api/admin/google-oauth/init"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/[0.05] border border-jjl-border text-jjl-muted hover:text-white text-[13px] font-semibold">
                Reconectar (otra cuenta)
              </a>
              <button onClick={disconnect} disabled={disconnecting}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-[13px] font-semibold disabled:opacity-50">
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-jjl-muted">Todavía no hay ninguna cuenta de Google conectada. Las subidas in-app van a seguir fallando con 403 hasta que conectes una.</p>
            <a href="/api/admin/google-oauth/init"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-jjl-red text-white text-[14px] font-semibold hover:bg-jjl-red-hover">
              <Cloud className="h-4 w-4" /> Conectar Google Drive
            </a>
            <p className="text-[11px] text-jjl-muted/80">Te va a pedir consent en Google y volver acá. Asegurate de elegir la cuenta correcta (la que sea dueña de la carpeta JJL Drive).</p>
          </div>
        )}
      </div>

      {status?.configured && <SetupGuide compact />}
    </div>
  );
}

function SetupGuide({ compact }: { compact?: boolean }) {
  return (
    <details className="rounded-lg border border-jjl-border bg-black/20 p-3" open={!compact}>
      <summary className="text-[12px] font-semibold text-white cursor-pointer">Setup en Google Cloud Console (one-time)</summary>
      <ol className="text-[12px] text-jjl-muted space-y-1.5 mt-2 ml-5 list-decimal">
        <li>Andá a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-jjl-red underline">Google Cloud Console → Credentials</a>.</li>
        <li>Elegí el proyecto donde está el service account (<code>feisty-pottery-492718-m0</code>).</li>
        <li>Click <b>"+ Create Credentials" → "OAuth client ID"</b>.</li>
        <li>Application type: <b>Web application</b>. Nombre: ej. "JJL App Uploads".</li>
        <li>En <b>Authorized redirect URIs</b> agregá: <code className="text-jjl-red break-all">https://alumno.jiujitsulatino.com/api/admin/google-oauth/callback</code></li>
        <li>Copiá el <b>Client ID</b> y <b>Client Secret</b> que te muestra.</li>
        <li>En Vercel → Settings → Environment Variables, agregá:
          <ul className="ml-5 list-disc">
            <li><code className="text-jjl-red">GOOGLE_OAUTH_CLIENT_ID</code> = (lo que te dio)</li>
            <li><code className="text-jjl-red">GOOGLE_OAUTH_CLIENT_SECRET</code> = (lo que te dio)</li>
          </ul>
        </li>
        <li>Redeploy (Vercel rebuildea solo cuando cambiás env vars en algunas setups; si no, push o redeploy manual).</li>
        <li>Volvé acá y click <b>"Conectar Google Drive"</b>.</li>
      </ol>
    </details>
  );
}

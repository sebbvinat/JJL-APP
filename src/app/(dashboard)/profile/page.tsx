'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Key, LogOut, Eye, EyeOff, Camera, User, Bell, BellOff, ZoomIn, ZoomOut, X as XIcon } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { profile, authUser, loading, signOut } = useUser();
  const searchParams = useSearchParams();
  const isResetMode = searchParams.get('reset') === '1';
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // For reset mode: wait for session to be established from hash token
  useEffect(() => {
    if (!isResetMode) {
      setSessionReady(true);
      return;
    }

    const supabase = createClient();

    // Process hash fragment and wait for session
    async function waitForSession() {
      // Give Supabase client time to process the hash fragment
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
        setShowPasswordForm(true);
        return;
      }

      // If no session yet, listen for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            setSessionReady(true);
            setShowPasswordForm(true);
            subscription.unsubscribe();
          }
        }
      );

      // Timeout fallback
      setTimeout(() => {
        setSessionReady(true);
        setShowPasswordForm(true);
        subscription.unsubscribe();
      }, 5000);
    }

    waitForSession();
  }, [isResetMode]);

  // Auto-open password form when coming from recovery link (non-reset mode)
  useEffect(() => {
    if (isResetMode && !showPasswordForm && sessionReady) {
      setShowPasswordForm(true);
    }
  }, [isResetMode, sessionReady, showPasswordForm]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch avatar URL directly from DB on mount
  useEffect(() => {
    if (!authUser) return;
    const supabase = createClient();
    supabase.from('users').select('avatar_url').eq('id', authUser.id).single()
      .then(({ data }: { data: any }) => {
        if (data?.avatar_url) setDbAvatarUrl(data.avatar_url);
      });
  }, [authUser]);

  // Use uploaded URL if just changed, then DB fetch, then profile from provider
  const avatarUrl = uploadedAvatarUrl || dbAvatarUrl || profile?.avatar_url || null;

  const [avatarError, setAvatarError] = useState('');
  const [showCrop, setShowCrop] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState('');
  const [cropScale, setCropScale] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [imgAspect, setImgAspect] = useState(1);
  const [dragging, setDragging] = useState(false);
  // Minimum scale that still lets the whole image fit inside the square.
  // For aspect>1 (wide) that's 1/aspect; for aspect<1 (tall) that's aspect.
  // Below this scale we'd start seeing empty space in the canvas crop.
  const fitScale = imgAspect > 1 ? 1 / imgAspect : imgAspect;
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  async function togglePush() {
    setPushLoading(true);
    if (pushEnabled) {
      // Can't programmatically revoke — tell user how
      alert('Para desactivar notificaciones, anda a la configuracion del navegador > Notificaciones > busca este sitio y bloquealo.');
      setPushLoading(false);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        setPushEnabled(true);
      }
    } catch {}
    setPushLoading(false);
  }

  const toast = useToast();

  const [showNameForm, setShowNameForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => { if (profile?.nombre) setNewName(profile.nombre); }, [profile?.nombre]);

  async function handleChangeName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) { toast.error('Ingresa un nombre'); return; }
    setSavingName(true);
    try {
      const res = await fetch('/api/profile/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      toast.success('Nombre actualizado');
      setShowNameForm(false);
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
    setSavingName(false);
  }

  const displayBelt = profile?.rol === 'admin' ? 'black' : (profile?.cinturon_actual || 'white');

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setCropPreview(URL.createObjectURL(file));
    setCropScale(1);
    setCropOffset({ x: 0, y: 0 });
    setShowCrop(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function openEditCurrentAvatar() {
    if (!avatarUrl || uploadingAvatar) return;
    setAvatarError('');
    try {
      // Cache-bust to avoid stale CORS-cached responses from prior loads.
      const res = await fetch(`${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch-failed');
      const blob = await res.blob();
      const file = new File([blob], 'current-avatar.jpg', { type: blob.type || 'image/jpeg' });
      setCropFile(file);
      setCropPreview(URL.createObjectURL(blob));
      setCropScale(1);
      setCropOffset({ x: 0, y: 0 });
      setShowCrop(true);
    } catch {
      // If CORS/network blocks the fetch, fall back to picking a new file.
      fileInputRef.current?.click();
    }
  }

  async function handleCropAndUpload() {
    if (!cropFile || !canvasRef.current || !imgRef.current) return;
    setUploadingAvatar(true);
    setAvatarError('');
    setShowCrop(false);

    // Draw cropped/scaled image to canvas
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    // Fit image to cover the square, then apply user scale and offset
    const aspect = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number;
    if (aspect > 1) {
      drawH = size * cropScale;
      drawW = drawH * aspect;
    } else {
      drawW = size * cropScale;
      drawH = drawW / aspect;
    }
    const offsetX = (size - drawW) / 2 + cropOffset.x * (size / 192);
    const offsetY = (size - drawH) / 2 + cropOffset.y * (size / 192);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
    );

    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.jpg');

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
      setUploadedAvatarUrl(data.avatar_url);
      toast.success('Foto actualizada');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir imagen';
      logger.error('profile.avatar.upload.failed', { err });
      setAvatarError(msg);
      toast.error(msg);
    }
    setUploadingAvatar(false);
    URL.revokeObjectURL(cropPreview);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      toast.error(updateError.message);
    } else {
      setMessage('Contraseña actualizada correctamente');
      toast.success('Contraseña actualizada');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    }
    setSaving(false);
  }

  // In reset mode, show a simplified view if not logged in
  if (isResetMode && !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
        <p className="text-jjl-muted text-sm">Verificando sesion...</p>
      </div>
    );
  }

  if (loading && !isResetMode) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Reset mode without full profile - show password form only
  if (isResetMode && !profile) {
    return (
      <div className="space-y-6 max-w-md mx-auto mt-12">
        <Card>
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-white p-1 flex items-center justify-center mx-auto mb-3">
              <img src="/logo-jjl.png" alt="JJL" width={40} height={40} />
            </div>
            <h1 className="text-xl font-bold">Cambiar Contraseña</h1>
            <p className="text-sm text-jjl-muted mt-1">Ingresa tu nueva contraseña</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="relative">
              <Input
                id="new-password"
                label="Nueva contraseña"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-jjl-muted hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input
              id="confirm-password"
              label="Confirmar contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeti la contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-green-400">{message}</p>}
            <Button type="submit" size="lg" className="w-full" loading={saving} disabled={saving}>
              Guardar contraseña
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full blur-3xl opacity-25"
          style={{
            background: 'radial-gradient(circle, rgba(220,38,38,0.6), transparent 70%)',
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-center gap-5">
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => avatarUrl ? openEditCurrentAvatar() : fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label={avatarUrl ? 'Ajustar recorte de la foto' : 'Subir foto de perfil'}
                title={avatarUrl ? 'Ajustar recorte' : 'Subir foto'}
                className="rounded-full transition-transform active:scale-95 hover:opacity-90 disabled:opacity-60"
              >
                <Avatar src={avatarUrl} name={profile?.nombre || 'Usuario'} size="lg" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Cambiar foto"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-jjl-red hover:bg-jjl-red-hover ring-2 ring-jjl-gray flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(220,38,38,0.55)] transition-colors"
              >
                {uploadingAvatar ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>
            {avatarError && (
              <p className="text-[11px] text-red-400 text-center mt-1">{avatarError}</p>
            )}
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-jjl-muted font-semibold mb-1">
              Perfil
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white truncate">
              {profile?.nombre || 'Usuario'}
            </h1>
            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
              <Badge belt={displayBelt} />
              <span className="text-xs text-jjl-muted truncate">{authUser?.email}</span>
            </div>
          </div>
          <div className="text-center px-5 py-3 rounded-xl bg-jjl-red/10 border border-jjl-red/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[28px] font-black text-jjl-red tabular-nums leading-none">
              {profile?.puntos || 0}
            </p>
            <p className="text-[10px] text-jjl-muted mt-1 uppercase tracking-wider font-semibold">
              Puntos
            </p>
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Configuracion</h2>
        <div className="space-y-3 divide-y divide-jjl-border/50 [&>*:not(:first-child)]:pt-3">
          {/* Change Name */}
          <button
            onClick={() => setShowNameForm(!showNameForm)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-jjl-gray-light/50 hover:bg-jjl-gray-light transition-colors text-left"
          >
            <User className="h-5 w-5 text-jjl-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium">Cambiar nombre</p>
              <p className="text-xs text-jjl-muted">Actualiza como aparece tu nombre</p>
            </div>
          </button>
          {showNameForm && (
            <form onSubmit={handleChangeName} className="ml-8 space-y-3 p-4 bg-jjl-gray-light/30 rounded-lg">
              <Input
                id="nombre"
                label="Nombre"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
              />
              <Button type="submit" size="sm" loading={savingName} disabled={savingName}>
                Guardar nombre
              </Button>
            </form>
          )}

          {/* Change Password */}
          <button
            onClick={() => { setShowPasswordForm(!showPasswordForm); setError(''); setMessage(''); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-jjl-gray-light/50 hover:bg-jjl-gray-light transition-colors text-left"
          >
            <Key className="h-5 w-5 text-jjl-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium">Cambiar contraseña</p>
              <p className="text-xs text-jjl-muted">Actualiza tu contraseña de acceso</p>
            </div>
          </button>

          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="ml-8 space-y-3 p-4 bg-jjl-gray-light/30 rounded-lg">
              <div className="relative">
                <Input
                  id="new-password"
                  label="Nueva contraseña"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-8 text-jjl-muted hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                id="confirm-password"
                label="Confirmar contraseña"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeti la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              {message && <p className="text-sm text-green-400">{message}</p>}
              <Button type="submit" size="sm" loading={saving} disabled={saving}>
                Guardar contraseña
              </Button>
            </form>
          )}

          {/* Push Notifications */}
          <button
            onClick={togglePush}
            disabled={pushLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-jjl-gray-light/50 hover:bg-jjl-gray-light transition-colors text-left"
          >
            {pushEnabled ? (
              <Bell className="h-5 w-5 text-green-400" />
            ) : (
              <BellOff className="h-5 w-5 text-jjl-muted" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Notificaciones push</p>
              <p className="text-xs text-jjl-muted">
                {pushEnabled ? 'Activadas — recibis alertas en tu dispositivo' : 'Desactivadas — toca para activar'}
              </p>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${pushEnabled ? 'bg-green-500' : 'bg-jjl-border'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all duration-200 ${pushEnabled ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Sign Out */}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-jjl-gray-light/50 hover:bg-red-900/20 transition-colors text-left group"
          >
            <LogOut className="h-5 w-5 text-jjl-muted group-hover:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium group-hover:text-red-400">Cerrar sesion</p>
              <p className="text-xs text-jjl-muted">Salir de tu cuenta</p>
            </div>
          </button>
        </div>
      </Card>

      {message && !showPasswordForm && (
        <div className="bg-green-900/30 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">
          {message}
        </div>
      )}

      {/* Image crop modal */}
      {showCrop && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-jjl-gray border border-jjl-border rounded-xl p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ajustar foto</h3>
              <button onClick={() => { setShowCrop(false); URL.revokeObjectURL(cropPreview); }} className="p-1 text-jjl-muted hover:text-white">
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Preview — drag to move, pinch/slider to zoom */}
            <div
              className="w-48 h-48 mx-auto rounded-full overflow-hidden bg-black relative cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => {
                setDragging(true);
                dragStart.current = { x: e.clientX, y: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragging) return;
                setCropOffset({
                  x: dragStart.current.ox + (e.clientX - dragStart.current.x),
                  y: dragStart.current.oy + (e.clientY - dragStart.current.y),
                });
              }}
              onPointerUp={() => setDragging(false)}
            >
              <canvas ref={canvasRef} className="hidden" />
              <img
                ref={imgRef}
                src={cropPreview}
                alt="Preview"
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) {
                    const a = el.naturalWidth / el.naturalHeight;
                    setImgAspect(a);
                    // Start at "fit" so the whole image is visible, not cropped.
                    const initial = a > 1 ? 1 / a : a;
                    setCropScale(initial);
                    setCropOffset({ x: 0, y: 0 });
                  }
                }}
                className="absolute pointer-events-none"
                style={{
                  // Explicit dimensions based on aspect + scale so the image
                  // is never clipped by object-fit. The canvas uses the same
                  // formulas, so what-you-see-is-what-you-save.
                  width: imgAspect > 1
                    ? `${100 * imgAspect * cropScale}%`
                    : `${100 * cropScale}%`,
                  height: imgAspect > 1
                    ? `${100 * cropScale}%`
                    : `${(100 / imgAspect) * cropScale}%`,
                  left: `calc(50% + ${cropOffset.x}px)`,
                  top: `calc(50% + ${cropOffset.y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
            <p className="text-[10px] text-jjl-muted text-center">Arrastra para mover · Slider para zoom</p>

            {/* Zoom controls */}
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setCropScale((s) => Math.max(fitScale, s - 0.1))} className="p-2.5 rounded-lg bg-jjl-gray-light hover:bg-jjl-border min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ZoomOut className="h-5 w-5" />
              </button>
              <input
                type="range"
                min={fitScale}
                max={3}
                step={0.01}
                value={cropScale}
                onChange={(e) => setCropScale(parseFloat(e.target.value))}
                className="flex-1 accent-jjl-red"
              />
              <button onClick={() => setCropScale((s) => Math.min(3, s + 0.1))} className="p-2.5 rounded-lg bg-jjl-gray-light hover:bg-jjl-border min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={handleCropAndUpload} loading={uploadingAvatar}>
              Guardar foto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

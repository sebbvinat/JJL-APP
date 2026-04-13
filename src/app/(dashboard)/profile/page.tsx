'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Key, LogOut, Eye, EyeOff, Camera } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarError('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
      setUploadedAvatarUrl(data.avatar_url);
      setMessage('Foto actualizada');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setAvatarError(err.message || 'Error al subir imagen');
    }
    setUploadingAvatar(false);
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    } else {
      setMessage('Contraseña actualizada correctamente');
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
        <div className="absolute inset-0 bg-gradient-to-br from-jjl-red/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <Avatar src={avatarUrl} name={profile?.nombre || 'Usuario'} size="lg" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-jjl-red flex items-center justify-center shadow-lg"
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
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            {avatarError && <p className="text-[11px] text-red-400 text-center">{avatarError}</p>}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-xl font-bold">{profile?.nombre || 'Usuario'}</h1>
            <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
              <Badge belt={profile?.cinturon_actual || 'white'} />
              <span className="text-sm text-jjl-muted">{authUser?.email}</span>
            </div>
          </div>
          <div className="text-center px-5 py-3 bg-jjl-red/10 rounded-xl shadow-sm shadow-jjl-red/10">
            <p className="text-3xl font-bold text-jjl-red drop-shadow-[0_0_6px_rgba(220,38,38,0.3)]">{profile?.puntos || 0}</p>
            <p className="text-xs text-jjl-muted">Puntos</p>
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Configuracion</h2>
        <div className="space-y-3 divide-y divide-jjl-border/50 [&>*:not(:first-child)]:pt-3">
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
    </div>
  );
}

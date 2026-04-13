'use client';

import { useState } from 'react';
import { Key, LogOut, Eye, EyeOff } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const { profile, authUser, loading, signOut } = useUser();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar name={profile?.nombre || 'Usuario'} size="lg" />
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-xl font-bold">{profile?.nombre || 'Usuario'}</h1>
            <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
              <Badge belt={profile?.cinturon_actual || 'white'} />
              <span className="text-sm text-jjl-muted">{authUser?.email}</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-jjl-red">{profile?.puntos || 0}</p>
            <p className="text-xs text-jjl-muted">Puntos</p>
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Configuracion</h2>
        <div className="space-y-3">
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

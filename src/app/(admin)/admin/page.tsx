'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import {
  Users,
  ChevronRight,
  Plus,
  Shield,
  ShieldOff,
  Trash2,
  Pencil,
  X,
  Save,
  BarChart3,
  Settings,
  Video,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import EngagementPanel from '@/components/admin/EngagementPanel';
import { fetcher } from '@/lib/fetcher';
import { logger } from '@/lib/logger';
import type { User } from '@/lib/supabase/types';

interface StudentRow extends User {
  unlocked_count: number;
}

type Tab = 'reportes' | 'gestion';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('reportes');
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-400/80 font-semibold mb-1.5">
            Panel de Instructor
          </p>
          <h1 className="text-3xl font-black tracking-tight">Administracion</h1>
          <p className="text-sm text-jjl-muted mt-1.5">
            Seguimiento, alertas y gestion de tus alumnos.
          </p>
        </div>
        <Link
          href="/admin/videos"
          className="inline-flex items-center gap-2 h-9 px-3 bg-white/[0.03] border border-jjl-border hover:border-jjl-border-strong hover:text-white text-jjl-muted rounded-lg text-[13px] font-semibold transition-colors"
        >
          <Video className="h-4 w-4" />
          Editor de videos
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-jjl-border rounded-xl p-1 w-fit">
        {[
          { key: 'reportes', label: 'Reportes', icon: BarChart3 },
          { key: 'gestion', label: 'Gestion', icon: Settings },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`inline-flex items-center gap-2 px-4 h-9 rounded-lg text-[13px] font-semibold transition-all ${
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

      {tab === 'reportes' ? <EngagementPanel /> : <StudentsManagement />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Students management tab
// ---------------------------------------------------------------------------

function StudentsManagement() {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useSWR<{ students: StudentRow[] }>(
    '/api/admin/students',
    fetcher,
    { revalidateOnFocus: true }
  );
  const students = data?.students || [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBelt, setEditBelt] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, nombre: newName }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Error al crear alumno');
      } else {
        setNewEmail('');
        setNewName('');
        setNewPassword('');
        setShowAddForm(false);
        toast.success('Alumno creado');
        mutate('/api/admin/students');
      }
    } catch (err) {
      logger.error('admin.createStudent.failed', { err });
      setError('Error al crear alumno');
    }
    setCreating(false);
  }

  async function toggleAdmin(studentId: string, currentRol: string) {
    const newRol = currentRol === 'admin' ? 'alumno' : 'admin';
    try {
      const res = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: studentId, rol: newRol }),
      });
      if (res.ok) {
        toast.success(newRol === 'admin' ? 'Ahora es admin' : 'Ya no es admin');
        mutate('/api/admin/students');
      } else {
        const body = await res.json();
        toast.error(body.error || 'Error al cambiar rol');
      }
    } catch (err) {
      logger.error('admin.toggleRole.failed', { err });
      toast.error('Error de conexion');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: confirmDelete.id }),
      });
      if (res.ok) {
        toast.success('Alumno eliminado');
        mutate('/api/admin/students');
        setConfirmDelete(null);
      } else {
        const body = await res.json();
        toast.error(body.error || 'Error al eliminar');
      }
    } catch (err) {
      logger.error('admin.delete.failed', { err });
      toast.error('Error de conexion');
    }
    setDeleting(false);
  }

  function startEdit(student: StudentRow) {
    setEditingId(student.id);
    setEditName(student.nombre);
    setEditEmail(student.email || '');
    setEditBelt(student.cinturon_actual);
    setEditPassword('');
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingId,
          nombre: editName,
          email: editEmail,
          cinturon_actual: editBelt,
          password: editPassword || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Cambios guardados');
        setEditingId(null);
        mutate('/api/admin/students');
      } else {
        const body = await res.json();
        toast.error(body.error || 'Error al guardar');
      }
    } catch (err) {
      logger.error('admin.updateUser.failed', { err });
      toast.error('Error de conexion');
    }
    setSaving(false);
  }

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-white">Alumnos</h2>
          <p className="text-[12px] text-jjl-muted mt-0.5">
            Crear, editar, asignar roles y modulos.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4" />
          Nuevo alumno
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <h3 className="text-[14px] font-bold text-white mb-3">Crear nuevo alumno</h3>
          <form onSubmit={handleCreateStudent} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Nombre completo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted/60 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted/60 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
              />
              <input
                type="text"
                placeholder="Contraseña temporal"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted/60 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" loading={creating}>
                Crear alumno
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {students.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin alumnos todavia"
            description="Usa el boton 'Nuevo alumno' para crear el primero."
            className="py-10"
          />
        ) : (
          <div className="space-y-1.5">
            {students.map((student) =>
              editingId === student.id ? (
                <EditRow
                  key={student.id}
                  name={editName}
                  email={editEmail}
                  belt={editBelt}
                  password={editPassword}
                  saving={saving}
                  onName={setEditName}
                  onEmail={setEditEmail}
                  onBelt={setEditBelt}
                  onPassword={setEditPassword}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <ViewRow
                  key={student.id}
                  student={student}
                  onEdit={() => startEdit(student)}
                  onToggleAdmin={() => toggleAdmin(student.id, student.rol || 'alumno')}
                  onDelete={() => setConfirmDelete(student)}
                />
              )
            )}
          </div>
        )}
      </Card>

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar alumno?"
          description={`Se eliminaran todos los datos de ${confirmDelete.nombre}. Esta accion no se puede deshacer.`}
          confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          destructive
          loading={deleting}
        />
      )}
    </div>
  );
}

function ViewRow({
  student,
  onEdit,
  onToggleAdmin,
  onDelete,
}: {
  student: StudentRow;
  onEdit: () => void;
  onToggleAdmin: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-jjl-border transition-colors">
      <Link
        href={`/admin/${student.id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <Avatar src={student.avatar_url} name={student.nombre} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-white truncate">
              {student.nombre}
            </span>
            <Badge belt={student.cinturon_actual} />
            {student.rol === 'admin' && (
              <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">
                Admin
              </span>
            )}
          </div>
          <p className="text-[12px] text-jjl-muted truncate">{student.email}</p>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <p
            className={`text-[12px] font-semibold tabular-nums ${
              student.unlocked_count > 0 ? 'text-green-400' : 'text-jjl-muted'
            }`}
          >
            {student.unlocked_count} modulos
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-jjl-muted/40 shrink-0 group-hover:text-jjl-red group-hover:translate-x-0.5 transition-all" />
      </Link>
      <div className="flex gap-0.5 shrink-0 border-l border-jjl-border/60 pl-1.5 ml-1">
        <IconBtn onClick={onEdit} label="Editar" icon={Pencil} />
        <IconBtn
          onClick={onToggleAdmin}
          label={student.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'}
          icon={student.rol === 'admin' ? ShieldOff : Shield}
          tone={student.rol === 'admin' ? 'amber' : undefined}
        />
        <IconBtn onClick={onDelete} label="Eliminar" icon={Trash2} tone="red" />
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  icon: Icon,
  tone,
}: {
  onClick: () => void;
  label: string;
  icon: typeof Pencil;
  tone?: 'red' | 'amber';
}) {
  const hover =
    tone === 'red'
      ? 'hover:text-red-400 hover:bg-red-900/20'
      : tone === 'amber'
        ? 'text-amber-400 hover:bg-amber-500/10'
        : 'hover:text-white hover:bg-white/5';
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-8 w-8 flex items-center justify-center rounded-lg text-jjl-muted transition-colors ${hover}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function EditRow({
  name,
  email,
  belt,
  password,
  saving,
  onName,
  onEmail,
  onBelt,
  onPassword,
  onSave,
  onCancel,
}: {
  name: string;
  email: string;
  belt: string;
  password: string;
  saving: boolean;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onBelt: (v: string) => void;
  onPassword: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-jjl-red/30 bg-jjl-red/5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Nombre"
          className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="Email"
          className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
        <select
          value={belt}
          onChange={(e) => onBelt(e.target.value)}
          className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white focus:outline-none focus:border-jjl-red"
        >
          <option value="white">Blanco</option>
          <option value="blue">Azul</option>
          <option value="purple">Purpura</option>
          <option value="brown">Marron</option>
          <option value="black">Negro</option>
        </select>
        <input
          type="text"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          placeholder="Nueva contraseña (vacio = no cambia)"
          className="px-3 py-2 bg-white/[0.03] border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red focus:ring-2 focus:ring-jjl-red/25"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onSave} loading={saving}>
          <Save className="h-3.5 w-3.5" />
          Guardar
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="max-w-sm w-full bg-jjl-gray border border-jjl-border rounded-2xl p-6 shadow-2xl animate-scale-in">
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        <p className="text-[13px] text-jjl-muted mt-2 leading-relaxed">{description}</p>
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="md" onClick={onCancel} fullWidth>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

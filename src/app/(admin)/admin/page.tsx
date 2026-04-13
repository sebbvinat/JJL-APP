'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Plus, Shield, ShieldOff, Trash2, Pencil, X, Save } from 'lucide-react';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { User } from '@/lib/supabase/types';

interface StudentRow extends User {
  unlocked_count: number;
}

export default function AdminPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      const res = await fetch('/api/admin/students');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error('Fetch students error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          nombre: newName,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Error al crear alumno');
        setCreating(false);
        return;
      }

      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setShowAddForm(false);
      await fetchStudents();
    } catch {
      setError('Error al crear alumno');
    }

    setCreating(false);
  }

  async function toggleAdmin(studentId: string, currentRol: string) {
    const newRol = currentRol === 'admin' ? 'alumno' : 'admin';
    const action = newRol === 'admin' ? 'hacer admin' : 'quitar admin';
    if (!confirm(`Seguro que quieres ${action} a este usuario?`)) return;

    try {
      const res = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: studentId, rol: newRol }),
      });
      if (res.ok) {
        setStudents((prev) =>
          prev.map((s) => s.id === studentId ? { ...s, rol: newRol } : s)
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Error al cambiar rol');
      }
    } catch {
      alert('Error al cambiar rol');
    }
  }

  async function handleDelete(studentId: string, nombre: string) {
    if (!confirm(`Seguro que quieres ELIMINAR a ${nombre}? Esta accion no se puede deshacer.`)) return;
    if (!confirm(`CONFIRMAR: Eliminar a ${nombre} y todos sus datos?`)) return;

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: studentId }),
      });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch {
      alert('Error al eliminar usuario');
    }
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
        setStudents((prev) =>
          prev.map((s) => s.id === editingId
            ? { ...s, nombre: editName, email: editEmail, cinturon_actual: editBelt as any }
            : s
          )
        );
        setEditingId(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch {
      alert('Error al guardar cambios');
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de Administracion</h1>
          <p className="text-jjl-muted mt-1">Gestiona el acceso de tus alumnos</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo Alumno
        </Button>
      </div>

      {/* Add student form */}
      {showAddForm && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">Crear Nuevo Alumno</h2>
          <form onSubmit={handleCreateStudent} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Nombre completo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red"
              />
              <input
                type="text"
                placeholder="Contraseña temporal"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted focus:outline-none focus:border-jjl-red"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={creating}>
                {creating ? 'Creando...' : 'Crear Alumno'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-jjl-red" />
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-xs text-jjl-muted">Alumnos Totales</p>
            </div>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-2xl font-bold text-green-400">
              {students.filter((s) => s.unlocked_count > 0).length}
            </p>
            <p className="text-xs text-jjl-muted">Con Modulos Activos</p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-2xl font-bold text-yellow-400">
              {students.filter((s) => s.unlocked_count === 0).length}
            </p>
            <p className="text-xs text-jjl-muted">Sin Modulos Asignados</p>
          </div>
        </Card>
      </div>

      {/* Student List */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Alumnos</h2>
        {students.length === 0 ? (
          <p className="text-jjl-muted text-sm py-8 text-center">
            No hay alumnos registrados. Usa el boton &quot;Nuevo Alumno&quot; para crear uno.
          </p>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <div key={student.id}>
                {editingId === student.id ? (
                  /* Edit mode */
                  <div className="p-4 rounded-lg border border-jjl-red/30 bg-jjl-red/5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre" className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white focus:outline-none focus:border-jjl-red"
                      />
                      <input
                        type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Email" className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white focus:outline-none focus:border-jjl-red"
                      />
                      <select
                        value={editBelt} onChange={(e) => setEditBelt(e.target.value)}
                        className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white focus:outline-none focus:border-jjl-red"
                      >
                        <option value="white">Blanco</option>
                        <option value="blue">Azul</option>
                        <option value="purple">Purpura</option>
                        <option value="brown">Marron</option>
                        <option value="black">Negro</option>
                      </select>
                      <input
                        type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Nueva contraseña (dejar vacio para no cambiar)" className="px-3 py-2 bg-jjl-gray-light border border-jjl-border rounded-lg text-sm text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={saving}>
                        <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-jjl-gray-light transition-colors border border-transparent hover:border-jjl-border">
                    <Link href={`/admin/${student.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar src={student.avatar_url} name={student.nombre} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{student.nombre}</span>
                          <Badge belt={student.cinturon_actual} />
                          {student.rol === 'admin' && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium">Admin</span>
                          )}
                        </div>
                        <p className="text-sm text-jjl-muted truncate">{student.email}</p>
                      </div>
                      <div className="hidden sm:block text-right shrink-0">
                        <p className="text-sm">
                          <span className={student.unlocked_count > 0 ? 'text-green-400' : 'text-jjl-muted'}>
                            {student.unlocked_count} modulos
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-jjl-muted shrink-0" />
                    </Link>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(student)} className="p-2 rounded-lg text-jjl-muted hover:text-white hover:bg-jjl-gray-light" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleAdmin(student.id, student.rol || 'alumno')}
                        className={`p-2 rounded-lg ${student.rol === 'admin' ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-jjl-muted hover:text-white hover:bg-jjl-gray-light'}`}
                        title={student.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'}>
                        {student.rol === 'admin' ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(student.id, student.nombre)} className="p-2 rounded-lg text-jjl-muted hover:text-red-400 hover:bg-red-900/20" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

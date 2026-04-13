'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Plus } from 'lucide-react';
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
              <Link
                key={student.id}
                href={`/admin/${student.id}`}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-jjl-gray-light transition-colors border border-transparent hover:border-jjl-border"
              >
                <Avatar name={student.nombre} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{student.nombre}</span>
                    <Badge belt={student.cinturon_actual} />
                  </div>
                  <p className="text-sm text-jjl-muted">{student.email}</p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm">
                    <span className={student.unlocked_count > 0 ? 'text-green-400' : 'text-jjl-muted'}>
                      {student.unlocked_count} modulos
                    </span>
                  </p>
                  <p className="text-xs text-jjl-muted">desbloqueados</p>
                </div>
                <ChevronRight className="h-5 w-5 text-jjl-muted shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

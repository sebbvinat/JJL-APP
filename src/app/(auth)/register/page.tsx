'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-14 w-14 bg-jjl-red rounded-xl flex items-center justify-center mb-4">
          <Flame className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">JIU JITSU LATINO</h1>
        <p className="text-jjl-muted text-sm mt-1">Crea tu cuenta de guerrero</p>
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        <Input
          id="nombre"
          label="Nombre completo"
          type="text"
          placeholder="Tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="password"
          label="Contrasena"
          type="password"
          placeholder="Minimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          id="confirmPassword"
          label="Confirmar contrasena"
          type="password"
          placeholder="Repite tu contrasena"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Crear Cuenta
        </Button>
      </form>

      <p className="text-center text-sm text-jjl-muted mt-6">
        Ya tienes cuenta?{' '}
        <Link href="/login" className="text-jjl-red hover:underline font-medium">
          Inicia sesion
        </Link>
      </p>
    </div>
  );
}

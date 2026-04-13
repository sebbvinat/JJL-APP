'use client';

import Link from 'next/link';

import { Lock } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm text-center">
      <div className="flex flex-col items-center mb-8">
        <img
          src="/logo-jjl.png?v=2"
          alt="JJL"
          width={56}
          height={56}
          className="mb-4"
        />
        <h1 className="text-2xl font-bold">JIU JITSU LATINO</h1>
      </div>

      <div className="bg-jjl-gray rounded-xl p-8 border border-jjl-border">
        <div className="h-16 w-16 bg-jjl-gray-light rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-jjl-muted" />
        </div>
        <h2 className="text-lg font-bold mb-2">Acceso Solo por Invitacion</h2>
        <p className="text-jjl-muted text-sm mb-6">
          Esta plataforma es exclusiva para alumnos del programa ADN.
          Tu instructor creara tu cuenta cuando te inscribas.
        </p>
        <Link href="/login">
          <Button variant="secondary" size="lg" className="w-full">
            Ya tengo cuenta — Iniciar Sesion
          </Button>
        </Link>
      </div>
    </div>
  );
}

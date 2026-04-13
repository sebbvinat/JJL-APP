import { Shield, BookOpen, Trophy, ArrowRight, Users, Calendar, UserCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center">
            <Image src="/logo-jjl.png" alt="JJL" width={32} height={32} unoptimized />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">JIU JITSU</h1>
            <p className="text-xs font-semibold text-jjl-red tracking-[0.2em] uppercase -mt-0.5">Latino</p>
          </div>
        </div>
        <Link
          href="/login"
          className="px-5 py-2 bg-jjl-red text-white text-sm font-semibold rounded-lg hover:bg-jjl-red-hover transition-colors shadow-md shadow-jjl-red/20"
        >
          Iniciar Sesion
        </Link>
      </header>

      {/* Hero */}
      <section className="relative px-6 py-20 max-w-4xl mx-auto text-center">
        {/* Radial gradient for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-jjl-red)_0%,_transparent_70%)] opacity-[0.06] pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-sm font-medium mb-8">
            <Shield className="h-4 w-4" />
            Programa ADN Exclusivo
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            Construi tu
            <span className="text-jjl-red"> Juego Ideal</span>
            <br />en 6 meses
          </h2>
          <p className="mt-6 text-lg text-jjl-muted max-w-2xl mx-auto">
            Programa personalizado para crear tu juego de Jiu Jitsu desde cero.
            24 semanas de tecnicas, drills y especificos con seguimiento 1 a 1.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-jjl-red text-white font-bold rounded-lg hover:bg-jjl-red-hover transition-all text-lg shadow-lg shadow-jjl-red/25 hover:shadow-xl hover:shadow-jjl-red/30 animate-[pulse-glow_3s_ease-in-out_infinite]"
            >
              Acceder a la Plataforma
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof stats row */}
      <section className="px-6 pb-12 max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-6 sm:gap-10 text-sm text-jjl-muted">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-jjl-red" />
            <span><strong className="text-white">200+</strong> guerreros</span>
          </div>
          <div className="h-4 w-px bg-jjl-border" />
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-jjl-red" />
            <span><strong className="text-white">24</strong> semanas</span>
          </div>
          <div className="h-4 w-px bg-jjl-border" />
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-jjl-red" />
            <span>Seguimiento <strong className="text-white">1 a 1</strong></span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpen,
              title: '24 Semanas de Contenido',
              description: 'Modulos progresivos con videos detallados de cada tecnica',
            },
            {
              icon: Trophy,
              title: 'Sistema de Cinturones',
              description: 'Progresa de blanco a negro mientras completas los modulos',
            },
            {
              icon: Shield,
              title: 'Seguimiento 1 a 1',
              description: 'Feedback personalizado y revision de tus luchas grabadas',
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-jjl-gray border border-jjl-border rounded-xl p-6 hover:border-jjl-red/30 transition-colors"
              >
                <div className="relative h-12 w-12 bg-jjl-red/10 rounded-lg flex items-center justify-center mb-4">
                  <div className="absolute inset-0 bg-jjl-red/20 rounded-lg blur-md" />
                  <Icon className="relative h-6 w-6 text-jjl-red" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="text-sm text-jjl-muted mt-2">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center">
        <div className="max-w-6xl mx-auto border-t border-transparent pt-8" style={{ borderImage: 'linear-gradient(90deg, transparent, #333333, var(--color-jjl-red), #333333, transparent) 1' }}>
          <p className="text-sm text-jjl-muted">
            &copy; 2026 Jiu Jitsu Latino. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

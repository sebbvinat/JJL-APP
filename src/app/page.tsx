import { Shield, BookOpen, Trophy, ArrowRight } from 'lucide-react';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo-jjl.png" alt="JJL" width={40} height={40} className="rounded-lg" />
          <div>
            <h1 className="text-lg font-bold leading-tight">JIU JITSU</h1>
            <p className="text-[10px] font-semibold text-jjl-red tracking-[0.2em] uppercase -mt-0.5">Latino</p>
          </div>
        </div>
        <Link
          href="/login"
          className="px-5 py-2 bg-jjl-red text-white text-sm font-semibold rounded-lg hover:bg-jjl-red-hover transition-colors"
        >
          Iniciar Sesion
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
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
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-jjl-red text-white font-bold rounded-lg hover:bg-jjl-red-hover transition-colors text-lg"
          >
            Acceder a la Plataforma
            <ArrowRight className="h-5 w-5" />
          </Link>
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
                <div className="h-12 w-12 bg-jjl-red/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-jjl-red" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="text-sm text-jjl-muted mt-2">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-jjl-border text-center">
        <p className="text-sm text-jjl-muted">
          &copy; 2026 Jiu Jitsu Latino. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}

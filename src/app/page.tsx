import {
  Shield,
  BookOpen,
  Trophy,
  ArrowRight,
  Users,
  Calendar,
  UserCheck,
  Target,
  Clock,
} from 'lucide-react';
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
            <p className="text-xs font-semibold text-jjl-red tracking-[0.2em] uppercase -mt-0.5">
              Latino
            </p>
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
      <section className="relative px-6 py-16 sm:py-20 max-w-4xl mx-auto text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-jjl-red)_0%,_transparent_70%)] opacity-[0.06] pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-jjl-red/10 border border-jjl-red/20 text-jjl-red text-sm font-medium mb-8">
            <Shield className="h-4 w-4" />
            Programa ADN Exclusivo
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            Construi tu
            <span className="text-jjl-red"> Juego Ideal</span>
            <br />
            en 6 meses
          </h2>
          <p className="mt-6 text-lg text-jjl-muted max-w-2xl mx-auto">
            Lo que aprenderías en 2 años de clases generales, en menos de 6 meses — entrenando las
            mismas horas que ya entrenás. Para practicantes <strong className="text-white">+30</strong>{' '}
            que quieren un juego propio, no más técnicas sueltas.
          </p>

          {/* Two-track CTA: prospects vs students */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <Link
              href="/consultoria-gratuita"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-jjl-red text-white font-bold rounded-lg hover:bg-jjl-red-hover transition-all text-lg shadow-lg shadow-jjl-red/25 hover:shadow-xl hover:shadow-jjl-red/30 animate-[pulse-glow_3s_ease-in-out_infinite]"
            >
              Hacé tu evaluación gratis
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 border border-jjl-border text-white font-semibold rounded-lg hover:border-jjl-red/40 hover:bg-white/[0.03] transition-colors text-base"
            >
              Ya soy alumno
            </Link>
          </div>
          <p className="mt-4 text-xs text-jjl-muted">
            60 segundos · 3 preguntas · Sin email para empezar
          </p>
        </div>
      </section>

      {/* Social proof stats row */}
      <section className="px-6 pb-12 max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-6 sm:gap-10 text-sm text-jjl-muted">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-jjl-red" />
            <span>
              <strong className="text-white">+350</strong> practicantes
            </span>
          </div>
          <div className="h-4 w-px bg-jjl-border" />
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-jjl-red" />
            <span>
              <strong className="text-white">24</strong> semanas
            </span>
          </div>
          <div className="h-4 w-px bg-jjl-border" />
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-jjl-red" />
            <span>
              Seguimiento <strong className="text-white">1 a 1</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Promise / pain row */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Target,
              title: 'Dejá de improvisar',
              description:
                'Vas a saber qué entrenar y cómo entrenarlo antes de pisar el tatami. Con un mapa de juego claro semana a semana.',
            },
            {
              icon: Clock,
              title: 'Sin entrenar más horas',
              description:
                'No te pedimos que sumes tiempo. Optimizamos las horas que ya entrenás para que cada clase rinda 3x más.',
            },
            {
              icon: Trophy,
              title: 'Hecho a tu medida',
              description:
                'Análisis de tu físico, tu edad, tu tiempo y tus lesiones. El juego se ajusta a vos — no al revés.',
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

      {/* Final CTA strip */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-jjl-red/30 bg-gradient-to-br from-jjl-red/10 to-transparent p-8 sm:p-10 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold leading-tight">
            ¿Cómo es tu juego hoy y cómo podría ser?
          </h3>
          <p className="mt-3 text-jjl-muted max-w-xl mx-auto">
            Hacé la evaluación de 60 segundos y reservá una consultoría 1 a 1 con un coach. Salís
            con un diagnóstico real y una dirección concreta — sin costo y sin obligación.
          </p>
          <Link
            href="/consultoria-gratuita"
            className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 bg-jjl-red text-white font-bold rounded-lg hover:bg-jjl-red-hover transition-colors shadow-lg shadow-jjl-red/25"
          >
            Empezar mi evaluación
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center">
        <div
          className="max-w-6xl mx-auto border-t border-transparent pt-8"
          style={{
            borderImage:
              'linear-gradient(90deg, transparent, #333333, var(--color-jjl-red), #333333, transparent) 1',
          }}
        >
          <p className="text-sm text-jjl-muted">
            &copy; 2026 Jiu Jitsu Latino. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

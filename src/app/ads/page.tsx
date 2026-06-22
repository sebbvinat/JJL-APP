import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import EvaluationQuiz from '@/components/consultoria/EvaluationQuiz';
import FaqAccordion from '@/components/consultoria/FaqAccordion';
import { FAQ_CONSULTORIA } from '@/lib/faq-consultoria';
import TrackAdsView from './track';

export const metadata: Metadata = {
  title: 'Construí tu juego ideal — Jiu Jitsu Latino',
  description:
    'Para practicantes +30 que quieren estar vigentes en el tatami y evolucionar sin entrenar horas de más. Hacé la evaluación gratis.',
};

const CALENDLY_URL =
  'https://calendly.com/jiujitsulatino/45m?hide_event_type_details=1&hide_gdpr_banner=1&background_color=1a1a1a&text_color=ffffff&primary_color=dc2626';

/**
 * Testimonios en video. Estructura tipo SYK: header con foto + meta, video
 * vertical 9:16 (formato reel), narrativa de 2-3 párrafos con la
 * estructura "antes → implementó → ahora → lo que se estaría perdiendo".
 *
 * `video` acepta:
 *   - URL de Wistia / YouTube unlisted / Vimeo (mejor para performance)
 *   - Ruta local /videos/xxx.mp4 (servido desde public/)
 * Si es undefined → muestra placeholder visual con texto "video próximamente".
 */
interface Testimonio {
  nombre: string;
  meta: string;
  /** URL embebible (iframe) o /videos/xxx.mp4 (servir desde public). */
  video?: string;
  /** true si `video` es archivo local mp4 (usa <video> nativo); false = iframe. */
  videoIsLocal?: boolean;
  /** Narrativa larga estilo Juanma de SYK. Cada string = un párrafo. */
  narrativa: string[];
}

const TESTIMONIOS: Testimonio[] = [
  {
    nombre: 'Koldo',
    meta: 'Programa JJL · Primera historia de éxito',
    // TODO: reemplazar con URL final del video subido (YouTube unlisted o
    // /public/videos/koldo-reel.mp4). Hoy está en escritorio de Sebastián.
    video: undefined,
    narrativa: [
      'Koldo entrenaba hace años pero veía cómo otros avanzaban y él se quedaba. No se sentía al nivel de su faixa y empezó a creer que la edad era el problema.',
      'Empezó el programa JJL y diseñó un juego enfocado en sus fortalezas, su edad y sus habilidades — sin sumar una sola hora de entrenamiento.',
      'Hoy se siente vigente de nuevo, motivado para el siguiente día y sin la sensación de quedarse atrás. Más allá del tatami, recuperó la sensación de estar en su prime.',
    ],
  },
  {
    nombre: 'Carlos A.',
    meta: 'Cinturón azul · 42 años',
    video: undefined,
    narrativa: [
      'Carlos llevaba 3 años entrenando 4 veces por semana pero seguía improvisando en cada lucha. Sentía que progresaba mucho más lento de lo que invertía.',
      'Implementó el sistema JJL y, en menos de 6 meses, tenía un plan claro semana a semana adaptado a su físico y tiempo.',
      'Hoy lucha con compañeros más jóvenes sin quedarse sin aire y sabe qué hacer en cada posición. Dejó de improvisar.',
    ],
  },
  {
    nombre: 'Demián V.',
    meta: 'Cinturón blanco · Córdoba',
    video: undefined,
    narrativa: [
      'Demián empezó hace meses y se sentía perdido entre tantas técnicas. No tenía idea de por dónde arrancar y cada clase era una pelea distinta.',
      'Con el programa JJL armó las bases primero — guardia, escapes, pasaje — antes de tirar técnicas sueltas.',
      'En 3 meses está luchando parejo con compañeros que llevan años. Tiene la base que casi nadie construye al principio.',
    ],
  },
];

export default function AdsLandingPage() {
  return (
    <main className="min-h-screen bg-jjl-dark text-white">
      <TrackAdsView />

      {/* Header */}
      <header className="px-5 py-3.5 border-b border-white/[0.06] sticky top-0 bg-jjl-dark/95 backdrop-blur-md z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0 ring-1 ring-white/20">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-md opacity-50 -z-0"
                style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.6), transparent 70%)' }}
              />
              <Image src="/logo-jjl.png" alt="JJL" width={22} height={22} className="relative z-10" />
            </div>
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase">Jiu Jitsu Latino</span>
          </div>
          <a
            href="#agendar"
            className="text-[11px] font-semibold px-3 py-1.5 border border-jjl-red/50 text-jjl-red hover:bg-jjl-red/10 rounded-full transition-colors inline-flex items-center gap-1"
          >
            Empezar
            <ArrowDown className="h-3 w-3" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-5 pt-12 lg:pt-20 pb-6 lg:pb-10 max-w-md lg:max-w-3xl mx-auto text-center lg:text-left">
        {/* Glow radial sutil atrás del título — mismo patrón que el dashboard */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-96 lg:h-[480px] -z-10"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgba(220,38,38,0.18), transparent 60%)',
          }}
        />
        <p className="text-[11px] uppercase tracking-[0.22em] text-jjl-red font-bold mb-4">
          Programa ADN Exclusivo
        </p>
        <h1 className="text-[34px] lg:text-[56px] xl:text-[64px] font-black tracking-tight leading-[1.05] mx-auto lg:mx-0">
          Construí tu juego{' '}
          <span className="text-jjl-red">ideal</span>
          {' '}en menos de 6 meses
        </h1>
        <p className="mt-5 lg:mt-7 text-[15px] lg:text-[19px] text-white/75 leading-relaxed mx-auto lg:mx-0 lg:max-w-2xl">
          Para practicantes +30 que quieren estar vigentes en el tatami
          y evolucionar sin entrenar horas de más.
        </p>
      </section>

      {/* Propuesta de valor */}
      <section className="px-5 py-6 lg:py-10 max-w-md lg:max-w-3xl mx-auto text-center lg:text-left">
        <p className="text-[15px] lg:text-[17px] leading-[1.75] text-white/85">
          Instalá un sistema de entrenamiento que te ordena semana a semana.
          Coach 1 a 1 que adapta el plan a tu físico, tu edad y tu tiempo.
          Sin sumar horas al tatami — optimizando las que ya entrenás.
        </p>
      </section>

      {/* Quiz embebido directo (donde otros pondrían un botón) */}
      <section
        id="agendar"
        className="px-4 py-8 lg:py-16 bg-gradient-to-b from-transparent to-jjl-red/[0.04] border-y border-white/[0.06]"
      >
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <div className="text-center mb-5 lg:mb-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-jjl-red font-bold">
              El siguiente paso
            </p>
            <h2 className="mt-2 text-[22px] lg:text-[32px] font-bold leading-tight">
              Hacé tu evaluación de juego
            </h2>
            <p className="mt-2 text-[12px] lg:text-[14px] text-white/60 leading-relaxed">
              60 segundos · 6 preguntas · sin email para empezar
            </p>
          </div>
          <EvaluationQuiz calendlyUrl={CALENDLY_URL} />
        </div>
      </section>

      {/* Titular de transición a casos */}
      <section className="px-5 py-12 lg:py-20 max-w-md lg:max-w-4xl mx-auto text-center">
        <h2 className="text-[22px] lg:text-[34px] font-bold leading-snug">
          Más de 350 alumnos que volvieron a ser{' '}
          <span className="text-jjl-red">competitivos</span> diseñando
          un juego enfocado en sus fortalezas, su edad y sus habilidades.
        </h2>
      </section>

      {/* Casos de éxito */}
      <section className="px-5 pb-10 lg:pb-20">
        <div className="max-w-md lg:max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
            {TESTIMONIOS.map((t) => (
              <TestimonialCard key={t.nombre} {...t} />
            ))}
          </div>
          <p className="text-center text-[11px] lg:text-[13px] text-white/40 pt-6">
            Más casos: Instagram @jjl.oficial
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-5 py-12 lg:py-20 bg-white/[0.02] border-t border-white/[0.04]">
        <div className="max-w-md lg:max-w-3xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.22em] text-jjl-red font-bold mb-4 lg:mb-8 text-center">
            Preguntas frecuentes
          </p>
          <FaqAccordion items={FAQ_CONSULTORIA} />
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 py-14 lg:py-24 text-center border-t border-jjl-red/20 bg-gradient-to-b from-transparent to-jjl-red/[0.08]">
        <div className="max-w-md lg:max-w-2xl mx-auto">
          <h3 className="text-[22px] lg:text-[32px] font-black leading-tight">
            ¿Y si tu próximo salto está a{' '}
            <span className="text-jjl-red">una evaluación</span>?
          </h3>
          <a
            href="#agendar"
            className="mt-6 lg:mt-8 inline-flex items-center justify-center gap-2 w-full lg:w-auto lg:px-10 h-14 px-6 bg-jjl-red hover:bg-jjl-red-hover text-white text-[15px] lg:text-[16px] font-bold rounded-xl transition-colors shadow-[0_10px_30px_-8px_rgba(220,38,38,0.55)]"
          >
            Hacer mi evaluación
            <ArrowDown className="h-4 w-4" />
          </a>
          <p className="mt-5 lg:mt-6 text-[11px] lg:text-[12px] text-white/50 leading-relaxed">
            Valoramos tu tiempo y el nuestro. Si vas a agendar para no
            asistir, por favor no agendes.
          </p>
        </div>
      </section>

      <footer className="px-5 py-6 text-center text-[10px] text-white/30 border-t border-white/[0.04]">
        © Jiu Jitsu Latino
      </footer>
    </main>
  );
}

/**
 * Card de testimonio estilo SYK: header (foto + meta), video VERTICAL 9:16
 * (formato reel/story — los testimonios reales fueron grabados en celular),
 * narrativa de 2-3 párrafos abajo.
 *
 * Cuando `video` es undefined muestra un placeholder vertical con play icon.
 * Cuando `videoIsLocal` es true usa <video> nativo HTML5 (mp4 servido desde
 * /public). Sino, embed iframe (Wistia, YouTube, Vimeo).
 */
function TestimonialCard({ nombre, meta, narrativa, video, videoIsLocal }: Testimonio) {
  return (
    <article className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 flex flex-col">
      <header className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full shrink-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(220,38,38,0.4), rgba(60,60,60,0.6))',
          }}
        />
        <div>
          <p className="text-[13px] font-bold">{nombre}</p>
          <p className="text-[11px] text-white/55">{meta}</p>
        </div>
      </header>

      {/* Video vertical 9:16 — mismo aspect en mobile y desktop como SYK.
          Centramos con max-w para que en desktop no quede gigantesco. */}
      <div className="mx-auto w-full max-w-[280px] mb-4">
        {video ? (
          videoIsLocal ? (
            <video
              src={video}
              controls
              playsInline
              preload="metadata"
              className="w-full aspect-[9/16] rounded-xl bg-black border border-white/[0.06] object-cover"
            />
          ) : (
            <div className="rounded-xl overflow-hidden border border-white/[0.06] aspect-[9/16] bg-black">
              <iframe
                src={video}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`Testimonio de ${nombre}`}
              />
            </div>
          )
        ) : (
          <div className="rounded-xl border border-white/[0.06] aspect-[9/16] bg-black/40 flex items-center justify-center relative">
            <div className="w-14 h-14 rounded-full bg-jjl-red/90 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-white"
                style={{ marginLeft: 2 }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-white/40 whitespace-nowrap">
              video próximamente
            </span>
          </div>
        )}
      </div>

      {/* Narrativa estilo SYK */}
      <div className="space-y-3">
        {narrativa.map((p, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-white/85">
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}

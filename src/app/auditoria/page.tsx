import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowDown, Rocket } from 'lucide-react';
import EvaluationQuiz from '@/components/consultoria/EvaluationQuiz';
import FaqAccordion from '@/components/consultoria/FaqAccordion';
import { FAQ_CONSULTORIA } from '@/lib/faq-consultoria';
import TrackAuditoriaView from './track';

/** Highlight inline para palabras clave dentro de la narrativa. */
function HL({ children }: { children: ReactNode }) {
  return <strong className="text-jjl-red font-semibold">{children}</strong>;
}

export const metadata: Metadata = {
  title: 'Construí tu juego ideal — Jiu Jitsu Latino',
  description:
    'Para practicantes +30 que quieren estar vigentes en el tatami y evolucionar sin entrenar horas de más. Hacé la evaluación gratis.',
};

// a4=bofu pre-rellena la 4ta pregunta custom de Calendly para etiquetar el
// agendamiento como proveniente de esta landing de ads (BOFU). Así se
// distinguen los bookings del ad de los orgánicos. El resto de params son
// de estilo (tema oscuro JJL).
const CALENDLY_URL =
  'https://calendly.com/jiujitsulatino/45m?a4=bofu&hide_event_type_details=1&hide_gdpr_banner=1&background_color=1a1a1a&text_color=ffffff&primary_color=dc2626';

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
  /** Métrica destacada del badge superior (ej "Volvió a competir a los 42"). */
  badge: string;
  /** Título grande del caso (ej "Recuperó su prime"). */
  titulo: string;
  nombre: string;
  meta: string;
  /** URL embebible (iframe) o /videos/xxx.mp4 (servir desde public). */
  video?: string;
  /** true si `video` es archivo local mp4 (usa <video> nativo); false = iframe. */
  videoIsLocal?: boolean;
  /** Narrativa estilo SYK. Cada elemento = un párrafo (ReactNode para highlights). */
  narrativa: ReactNode[];
}

const TESTIMONIOS: Testimonio[] = [
  {
    badge: 'Campeón Mercosur · Faixa preta',
    titulo: 'De estancado a campeón',
    nombre: 'Sebastián Viñat',
    meta: 'Cinturón negro · Campeón Mercosur',
    video: '/videos/seba-vinat.mp4',
    videoIsLocal: true,
    narrativa: [
      <>Sebastián venía <HL>estancado</HL>: pesadez, desgaste físico y mental, lesiones, y la sensación de no rendir. Le dedicaba horas y no avanzaba — <HL>ya no sentía la magia del principio</HL>.</>,
      <>Reordenó su juego con el sistema JJL, enfocado en su físico, su tiempo y sus fortalezas. Bajó las lesiones y <HL>volvió a disfrutar cada entrenamiento</HL>.</>,
      <>Hoy es <HL>Campeón Mercosur</HL> y acaba de recibir su <HL>faixa preta</HL> — el cinturón negro.</>,
    ],
  },
  {
    badge: 'Volvió a sentirse en su prime',
    titulo: 'De estancado a vigente',
    nombre: 'Koldo',
    meta: 'Programa JJL · Alumno',
    video: '/videos/koldo.mp4',
    videoIsLocal: true,
    narrativa: [
      <>Koldo entrenaba hace años pero veía cómo <HL>otros avanzaban y él se quedaba</HL>. No se sentía al nivel de su faixa y empezó a creer que la edad era el problema.</>,
      <>Empezó el programa JJL y diseñó un juego enfocado en <HL>sus fortalezas, su edad y sus habilidades</HL> — sin sumar una sola hora de entrenamiento.</>,
      <>Hoy se siente <HL>vigente de nuevo</HL>, motivado para el siguiente día y sin la sensación de quedarse atrás. Recuperó la sensación de estar en su prime.</>,
    ],
  },
  {
    badge: 'Motivado al siguiente día',
    titulo: 'Volver a creer que se puede',
    nombre: 'Seba Riveros',
    meta: 'Programa JJL · Alumno',
    video: '/videos/seba-riveros.mp4',
    videoIsLocal: true,
    narrativa: [
      <>Seba tenía <HL>miedo a la siguiente faixa</HL> y no se sentía a la altura de su cinturón. Creía que con ir a la clase ya alcanzaba.</>,
      <>En el grupo encontró un nivel distinto: dejó de entrenar a ciegas y empezó a <HL>entender de verdad lo que hacía</HL>.</>,
      <>Hoy se levanta <HL>motivado para el siguiente día</HL> — y esa sensación de que se puede lograr la llevó a otros aspectos de su vida.</>,
    ],
  },
];

export default function AdsLandingPage() {
  return (
    <main className="min-h-screen bg-jjl-dark text-white">
      <TrackAuditoriaView />

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

      {/* Propuesta de valor — abajo del quiz, titular corto estilo SYK */}
      <section className="px-5 py-10 lg:py-16 max-w-md lg:max-w-3xl mx-auto text-center">
        <h2 className="text-[24px] lg:text-[36px] font-black tracking-tight leading-[1.15]">
          Un sistema que te ordena el juego,{' '}
          <span className="text-jjl-red">sin sumar horas</span>
        </h2>
      </section>

      {/* Titular de transición a casos */}
      <section className="px-5 py-12 lg:py-20 max-w-md lg:max-w-4xl mx-auto text-center">
        <h2 className="text-[22px] lg:text-[34px] font-bold leading-snug">
          Más de 350 alumnos que volvieron a ser{' '}
          <span className="text-jjl-red">competitivos</span> diseñando
          un juego enfocado en sus fortalezas, su edad y sus habilidades.
        </h2>
      </section>

      {/* Casos de éxito — 1 por fila, layout horizontal (texto + video) */}
      <section className="px-5 pb-10 lg:pb-20">
        <div className="max-w-md lg:max-w-5xl mx-auto space-y-5 lg:space-y-7">
          {TESTIMONIOS.map((t) => (
            <TestimonialCard key={t.nombre} {...t} />
          ))}
          <p className="text-center text-[11px] lg:text-[13px] text-white/40 pt-2">
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
 * Card de testimonio estilo SYK: card con tinte de marca, layout HORIZONTAL
 * en desktop (texto a la izquierda ~55%, video vertical a la derecha ~45%)
 * y apilado en mobile (texto arriba, video abajo).
 *
 * Estructura del texto: badge (métrica) → título → narrativa con highlights
 * → foto + nombre abajo.
 *
 * Video vertical 9:16. `videoIsLocal` → <video> nativo; sino iframe embed.
 */
function TestimonialCard({
  badge,
  titulo,
  nombre,
  meta,
  narrativa,
  video,
  videoIsLocal,
}: Testimonio) {
  return (
    <article
      className="rounded-3xl border border-jjl-red/20 overflow-hidden p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8"
      style={{
        background:
          'linear-gradient(135deg, rgba(220,38,38,0.10) 0%, rgba(20,8,8,0.4) 55%, rgba(10,10,10,0.2) 100%)',
      }}
    >
      {/* Columna texto */}
      <div className="lg:flex-1 lg:order-1 order-2">
        {/* Badge métrica */}
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-jjl-red/15 border border-jjl-red/30 text-jjl-red text-[12px] font-bold mb-4">
          <Rocket className="h-3.5 w-3.5" />
          {badge}
        </span>

        {/* Título del caso */}
        <h3 className="text-[26px] lg:text-[30px] font-black tracking-tight leading-none mb-4">
          {titulo}
        </h3>

        {/* Narrativa */}
        <div className="space-y-3">
          {narrativa.map((p, i) => (
            <p key={i} className="text-[14px] lg:text-[15px] leading-relaxed text-white/85">
              {p}
            </p>
          ))}
        </div>

        {/* Nombre abajo (sin foto) */}
        <div className="mt-6 pt-5 border-t border-white/[0.08]">
          <p className="text-[14px] font-bold">{nombre}</p>
          <p className="text-[11px] text-white/55 mt-0.5">{meta}</p>
        </div>
      </div>

      {/* Columna video vertical 9:16 */}
      <div className="lg:order-2 order-1 mx-auto lg:mx-0 w-full max-w-[260px] lg:max-w-[300px] shrink-0">
        {video ? (
          videoIsLocal ? (
            <video
              src={video}
              controls
              playsInline
              preload="metadata"
              className="w-full aspect-[9/16] rounded-2xl bg-black border border-white/[0.08] object-cover"
            />
          ) : (
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] aspect-[9/16] bg-black">
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
          <div className="rounded-2xl border border-white/[0.08] aspect-[9/16] bg-black/40 flex items-center justify-center relative">
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
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/40 whitespace-nowrap">
              video próximamente
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

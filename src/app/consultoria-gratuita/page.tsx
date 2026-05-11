import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check,
  Stethoscope,
  Compass,
  Flag,
  ShieldCheck,
  Target,
  Wrench,
  X,
  Trophy,
  ArrowRight,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import EvaluationQuiz from '@/components/consultoria/EvaluationQuiz';
import FaqAccordion from '@/components/consultoria/FaqAccordion';
import TrackConsultoriaView from './track';

export const metadata: Metadata = {
  title: 'Construí tu juego ideal — Jiu Jitsu Latino',
  description:
    'Hacé tu evaluación (60 segundos, 6 preguntas) y, si tu juego encaja, agendá una sesión 1 a 1 con un coach. Para practicantes +30 que quieren un juego propio sin entrenar más horas.',
};

const CALENDLY_URL =
  'https://calendly.com/jiujitsulatino/45m?hide_event_type_details=1&hide_gdpr_banner=1&background_color=1a1a1a&text_color=ffffff&primary_color=dc2626';

const deliverables = [
  {
    icon: Stethoscope,
    title: 'Diagnóstico claro de tu juego actual',
    body: 'Identificamos qué te está limitando hoy: posiciones donde sobrevivís, fugas de energía y hábitos que te estancan.',
  },
  {
    icon: Compass,
    title: 'Dirección concreta según tu contexto',
    body: 'Te mostramos qué tenés que ordenar — físico, tiempo, edad — para dejar de improvisar en cada lucha.',
  },
  {
    icon: Flag,
    title: 'Próximo paso recomendado',
    body: 'Salís sabiendo si esto lo podés resolver solo o si te conviene un acompañamiento. Sin venta forzada.',
  },
];

const pilares = [
  {
    icon: Target,
    title: 'Análisis de contexto',
    body: 'Estudiamos tu forma de entrenar, tu juego actual, tu físico, tu tiempo y tus lesiones. Todo lo que aprendas va a estar hecho a tu medida — no es un instruccional genérico.',
  },
  {
    icon: Compass,
    title: 'Diseño de tu juego deseado',
    body: 'Trabajamos los 4 fundamentos (pasaje, guardia, top, bottom) con 3 a 5 posiciones ancla por fundamento. Te volvés pro en lo que importa, no en todo.',
  },
  {
    icon: Wrench,
    title: 'Ejecución y acompañamiento',
    body: 'Sistema Híbrido + plan semanal claro + seguimiento 1 a 1 por chat y llamadas. Sabés qué entrenar y cómo entrenarlo antes de ir al tatami.',
  },
];

const testimonials = [
  {
    quote:
      'JJL me enseñó a entrenar con propósito y a conectar técnicas con conceptos. Muy recomendado.',
    name: 'Julián',
    meta: 'Cinturón blanco',
  },
  {
    quote:
      'Entreno 3 veces por semana con dos hijos chicos y pensaba que no iba a progresar más. Empecé a ver patrones que antes ignoraba y hoy lucho con gente más joven sin quedarme sin aire.',
    name: 'Martín',
    meta: 'Cinturón azul · 2 años entrenando',
  },
  {
    quote:
      'A los 42 me costaba horrores pasar la guardia. En lugar de darme más técnicas, me ayudaron a ordenar lo que ya sabía. Cambió completamente cómo pienso la lucha.',
    name: 'Diego',
    meta: 'Cinturón púrpura · +40 años',
  },
];

const faqItems = [
  {
    question: '¿Qué pasa exactamente en los 45 minutos?',
    answer:
      'Te hacemos preguntas sobre cómo entrenás, tu físico y lo que sentís que te frena. Analizamos tu juego actual y te mostramos qué está limitándote. Al final, te damos una dirección clara y vos decidís el siguiente paso.',
  },
  {
    question: '¿Es para mí si tengo +40 o soy principiante?',
    answer:
      'Sí. Trabajamos con practicantes de 30 a 55 que entrenan al menos 2 veces por semana. No importa el cinturón — lo que importa es que quieras ordenar tu juego y aprovechar mejor tu tiempo.',
  },
  {
    question: '¿Necesito entrenar más horas?',
    answer:
      'No. El objetivo es optimizar tu entrenamiento con el tiempo que ya tenés y la clase a la que ya asistís. No vamos a pedirte que sumes horas — vamos a ordenar lo que ya hacés.',
  },
  {
    question: '¿Cuál es la diferencia con un instruccional?',
    answer:
      'Un instruccional te muestra técnicas sueltas y generales, sin acompañamiento ni personalización. Acá desarrollás un juego completo a la medida de tu cuerpo y tu tiempo, con acompañamiento del equipo todos los días.',
  },
  {
    question: '¿Y si al final no me funciona?',
    answer:
      'Si al terminar el programa sentís que no estás pudiendo aplicar el juego que trabajamos, te seguimos acompañando gratis hasta que lo logres. El riesgo es nuestro.',
  },
  {
    question: '¿Puedo hacerlo desde cualquier ciudad?',
    answer:
      'Sí. Todo el acompañamiento es online — sesiones 1 a 1 por video, plan semanal y chat. Las clases en tu gimnasio actual siguen siendo donde aplicás todo. Nos amoldamos a tu zona horaria.',
  },
];

function Topbar() {
  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-jjl-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center">
            <Image src="/logo-jjl.png" alt="JJL" width={32} height={32} unoptimized />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold">JIU JITSU</div>
            <div className="text-[10px] font-semibold text-jjl-red tracking-[0.2em] uppercase -mt-0.5">
              Latino
            </div>
          </div>
        </Link>
        <Link
          href="/login"
          className="text-sm text-jjl-muted hover:text-white transition-colors"
        >
          Soy alumno · Iniciar sesión
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-jjl-dark" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(220,38,38,0.18),transparent_60%)]" />

      <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-[55fr_45fr] gap-10 lg:gap-12 items-start">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-jjl-red/10 border border-jjl-red/25 text-jjl-red text-[11px] font-semibold tracking-[0.18em] uppercase">
            <Trophy className="h-3.5 w-3.5" />
            Evaluación gratis · 60 segundos
          </div>
          <h1 className="mt-6 font-black leading-[1.05] text-4xl sm:text-5xl lg:text-[56px]">
            Construí tu <span className="text-jjl-red">juego ideal</span> según tu edad, tu físico y
            tu tiempo.
          </h1>
        </div>

        <div className="lg:sticky lg:top-24">
          <div className="mb-3 text-center text-[12px] uppercase tracking-[0.18em] text-jjl-muted">
            Empezá tu evaluación
          </div>
          <EvaluationQuiz calendlyUrl={CALENDLY_URL} />

          {/* Bullets + prueba social — debajo del formulario para que el form
              sea lo primero que ven y esto refuerce justo después. */}
          <ul className="mt-8 space-y-3">
            <li className="flex items-start gap-3 text-white/90">
              <Check className="h-5 w-5 text-jjl-red flex-shrink-0 mt-0.5" />
              <span>
                Dejá de <strong className="text-white">improvisar</strong> en cada lucha
              </span>
            </li>
            <li className="flex items-start gap-3 text-white/90">
              <Check className="h-5 w-5 text-jjl-red flex-shrink-0 mt-0.5" />
              <span>
                Sabé exactamente <strong className="text-white">qué entrenar y cómo</strong> antes
                de pisar el tatami
              </span>
            </li>
            <li className="flex items-start gap-3 text-white/90">
              <Check className="h-5 w-5 text-jjl-red flex-shrink-0 mt-0.5" />
              <span>
                Hecho para <strong className="text-white">practicantes +30</strong> que entrenan 2-3
                veces por semana
              </span>
            </li>
          </ul>
          <div className="mt-6 flex items-center gap-3 text-sm text-jjl-muted">
            <span className="text-jjl-red tracking-widest">★★★★★</span>
            <span>
              <strong className="text-white">+350 practicantes</strong> ya ordenaron su juego con el
              método.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pilares() {
  return (
    <section data-scroll-target="next" className="bg-black/60 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            Nuestro método
          </div>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold leading-tight">
            3 pilares que vuelven cada hora de entrenamiento{' '}
            <span className="text-jjl-red">3x más eficiente</span>
          </h2>
          <p className="mt-4 text-jjl-muted max-w-2xl mx-auto">
            No reemplazamos tus clases. Las potenciamos. Acá trabajamos exclusivamente sobre tu
            juego — qué posiciones te convienen, qué estilo construir y cómo entrenar cada semana
            para que las clases que ya hacés realmente te hagan progresar.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {pilares.map(({ icon: Icon, title, body }) => (
            <Card key={title} hover>
              <div className="h-12 w-12 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 flex items-center justify-center text-jjl-red">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm text-jjl-muted leading-relaxed">{body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Deliverables() {
  return (
    <section className="bg-jjl-dark py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            En 45 minutos
          </div>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold">Qué te llevás de la consultoría</h2>
          <p className="mt-4 text-jjl-muted max-w-2xl mx-auto">
            La sesión vale por sí misma — incluso si después no avanzás con el programa, salís con
            algo concreto que aplicar la próxima vez que pises el tatami.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {deliverables.map(({ icon: Icon, title, body }) => (
            <Card key={title} hover>
              <Icon className="h-10 w-10 text-jjl-red" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm text-jjl-muted leading-relaxed">{body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Polarization() {
  return (
    <section className="bg-black/60 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            Honestidad primero
          </div>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold">No es para todos</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-jjl-red/30 bg-jjl-red/5 p-6">
            <div className="flex items-center gap-2 text-jjl-red text-[11px] font-bold uppercase tracking-[0.16em]">
              <Check className="h-4 w-4" />
              Sí es para vos si...
            </div>
            <ul className="mt-5 space-y-3 text-[15px] text-white/90">
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-jjl-red mt-1 shrink-0" />
                <span>Tenés +30, trabajás y entrenás 2-3 veces por semana.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-jjl-red mt-1 shrink-0" />
                <span>Sentís que estás luchando siempre igual y querés un sistema, no más técnicas sueltas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-jjl-red mt-1 shrink-0" />
                <span>Querés disfrutar el BJJ como hobbie sin sentir que perdés el tiempo.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 text-jjl-red mt-1 shrink-0" />
                <span>Estás dispuesto a comprometerte con un proceso de 3 a 6 meses.</span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-jjl-border bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 text-jjl-muted text-[11px] font-bold uppercase tracking-[0.16em]">
              <X className="h-4 w-4" />
              No es para vos si...
            </div>
            <ul className="mt-5 space-y-3 text-[15px] text-white/70">
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 text-jjl-muted mt-1 shrink-0" />
                <span>Buscás resultados YA sin pasar por un proceso.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 text-jjl-muted mt-1 shrink-0" />
                <span>No entrenás regularmente o no tenés un gimnasio donde aplicar lo que ves.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 text-jjl-muted mt-1 shrink-0" />
                <span>Sólo querés ver técnicas sueltas — para eso ya hay instruccionales.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 text-jjl-muted mt-1 shrink-0" />
                <span>No estás dispuesto a confiar en una metodología distinta a lo que hacés hoy.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Guarantee() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-jjl-red/30 bg-gradient-to-br from-jjl-red/15 via-transparent to-transparent p-8 sm:p-10 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-jjl-red/15 ring-1 ring-jjl-red/30 flex items-center justify-center text-jjl-red">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl sm:text-3xl font-bold leading-tight">
            Garantía: si no te funciona, seguimos sin pagarnos.
          </h2>
          <p className="mt-4 text-jjl-muted leading-relaxed">
            Si al terminar el programa sentís que no estás pudiendo aplicar el juego que armamos,
            te seguimos acompañando <strong className="text-white">gratis</strong> hasta que lo
            logres. El riesgo es nuestro — vos venís a entrenar.
          </p>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-black/60 py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            Casos reales
          </div>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold">+350 practicantes ordenaron su juego</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {testimonials.map(({ quote, name, meta }) => (
            <Card key={name} className="relative" hover>
              <span
                aria-hidden
                className="absolute top-4 left-5 text-[56px] leading-none font-serif text-jjl-red/60"
              >
                &ldquo;
              </span>
              <p className="mt-12 italic text-white/90 text-[15px] leading-relaxed">{quote}</p>
              <div className="mt-5 pt-4 border-t border-jjl-border">
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xs text-jjl-muted mt-1">{meta}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-jjl-dark py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            Dudas frecuentes
          </div>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold">Antes de reservar</h2>
        </div>
        <FaqAccordion items={faqItems} />
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative py-16 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-jjl-red/12 to-transparent" />
      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="text-3xl lg:text-4xl font-bold">¿Listo para ordenar tu juego?</h2>
        <p className="mt-3 text-jjl-muted">
          60 segundos de evaluación · 45 min con un coach · Sin costo
        </p>
        <a
          href="#top"
          className="mt-8 inline-flex items-center gap-2 h-12 px-6 bg-jjl-red text-white font-semibold rounded-xl shadow-[0_8px_24px_-8px_rgba(220,38,38,0.5)] hover:bg-jjl-red-hover transition-colors"
        >
          Empezar evaluación
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-jjl-border py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-jjl-muted">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white p-1 flex items-center justify-center">
            <Image src="/logo-jjl.png" alt="JJL" width={24} height={24} unoptimized />
          </div>
          <span>© 2026 Jiu Jitsu Latino</span>
        </div>
        <div className="flex gap-6">
          <a
            href="https://instagram.com/jiujitsulatino"
            className="hover:text-white transition-colors"
          >
            Instagram
          </a>
          <a
            href="https://youtube.com/@jiujitsulatino"
            className="hover:text-white transition-colors"
          >
            YouTube
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function ConsultoriaPage() {
  return (
    <main id="top" className="min-h-screen bg-jjl-dark text-white font-sans overflow-x-hidden">
      <TrackConsultoriaView />
      <Topbar />
      <Hero />
      <Pilares />
      <Deliverables />
      <Polarization />
      <Guarantee />
      <Testimonials />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  );
}

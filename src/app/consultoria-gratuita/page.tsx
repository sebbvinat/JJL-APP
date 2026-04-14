import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Stethoscope, Compass, Flag } from 'lucide-react';
import Card from '@/components/ui/Card';
import CalendlyEmbed from '@/components/consultoria/CalendlyEmbed';
import FaqAccordion from '@/components/consultoria/FaqAccordion';

export const metadata: Metadata = {
  title: 'Consultoría gratuita — Jiu Jitsu Latino',
  description:
    'Sesión estratégica 1 a 1 de 45 min para practicantes +30 que quieren construir un juego propio alineado a su edad, físico y fortalezas.',
};

const CALENDLY_URL =
  'https://calendly.com/jiujitsulatino/45m?hide_event_type_details=1&hide_gdpr_banner=1&background_color=1a1a1a&text_color=ffffff&primary_color=dc2626';

const deliverables = [
  {
    icon: Stethoscope,
    title: 'Diagnóstico claro de tu juego actual',
    body: 'Identificamos qué está limitando tu progreso hoy: posiciones donde sobrevivís, fugas de energía y hábitos que te estancan.',
  },
  {
    icon: Compass,
    title: 'Dirección concreta según tu contexto',
    body: 'Te mostramos qué tenés que empezar a ordenar — físico, tiempo, edad — para dejar de improvisar en cada lucha.',
  },
  {
    icon: Flag,
    title: 'Próximo paso recomendado',
    body: 'Salís sabiendo si esto lo podés resolver solo o si te conviene un acompañamiento. Sin compromiso ni venta forzada.',
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
      'Entreno 3 veces por semana con dos hijos chicos y pensaba que no iba a progresar más. Con el sistema empecé a ver patrones que antes ignoraba y hoy lucho con gente más joven sin quedarme sin aire.',
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
      'Te hacemos preguntas sobre cómo entrenás, tu físico y lo que sentís que te frena. Analizamos juntos tu juego actual y te mostramos qué está limitándote. Al final, te damos una dirección clara y vos decidís el siguiente paso.',
  },
  {
    question: '¿Es para mí si tengo +40 o soy principiante?',
    answer:
      'Sí. Trabajamos con practicantes de 30 a 55 que entrenan al menos 2 veces por semana. No importa el cinturón — lo que importa es que quieras ordenar tu juego y aprovechar mejor tu tiempo.',
  },
  {
    question: '¿Necesito entrenar más tiempo del que ya entreno?',
    answer:
      'No. El objetivo es optimizar tu entrenamiento con el tiempo que ya tenés disponible y la clase a la que asistís actualmente. No vamos a pedirte que sumes horas — vamos a ordenar lo que ya hacés.',
  },
  {
    question: '¿Cuál es la diferencia entre el programa y un instruccional?',
    answer:
      'Un instruccional te muestra técnicas sueltas y generales, sin acompañamiento ni personalización. Todo queda por tu cuenta. El programa está hecho a la medida: desarrollás un juego completo e ideal para vos, con acompañamiento 24 hs de los profesores.',
  },
  {
    question: '¿Y si no me funciona?',
    answer:
      'Si al final del programa sentís que no estás pudiendo aplicar el juego que trabajamos, te seguimos acompañando gratis hasta que lo logres.',
  },
];

function Topbar() {
  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-jjl-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <Link href="https://jiujitsulatino.com" className="flex items-center gap-3">
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
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-jjl-dark" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(220,38,38,0.18),transparent_60%)]" />

      <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-[55fr_45fr] gap-12 items-center">
        <div>
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            Consultoría gratuita · 45 min · 1 a 1
          </div>
          <h1 className="mt-6 font-black leading-[1.05] text-4xl sm:text-5xl lg:text-6xl">
            Construí un <span className="text-jjl-red">juego propio</span> alineado a tu edad,
            físico y fortalezas.
          </h1>
          <p className="mt-6 text-lg text-jjl-muted max-w-xl">
            En 45 min analizamos tu juego, detectamos qué te está frenando y te damos una
            dirección clara — sin entrenar más horas ni sacrificar tu vida profesional.
          </p>
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
                Optimizá el <strong className="text-white">tiempo que ya entrenás</strong>
              </span>
            </li>
            <li className="flex items-start gap-3 text-white/90">
              <Check className="h-5 w-5 text-jjl-red flex-shrink-0 mt-0.5" />
              <span>
                Pensado para <strong className="text-white">practicantes +30</strong>
              </span>
            </li>
          </ul>
          <div className="mt-10 flex items-center gap-3 text-sm text-jjl-muted">
            <span className="text-jjl-red tracking-widest">★★★★★</span>
            <span>
              <strong className="text-white">+350 practicantes</strong> ya ordenaron su juego con
              el método.
            </span>
          </div>
        </div>

        <div className="bg-jjl-gray rounded-xl border border-jjl-red/30 p-6">
          <h2 className="text-xl font-semibold">Elegí día y horario</h2>
          <p className="text-sm text-jjl-muted mt-1 mb-5">Tu sesión es gratis y sin compromiso.</p>
          <CalendlyEmbed url={CALENDLY_URL} />
          <p className="mt-4 text-xs text-jjl-muted text-center">
            Sin costo · Sin obligación · 45 min reales con un coach
          </p>
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
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold">
            Qué te llevás de la consultoría
          </h2>
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

function Testimonials() {
  return (
    <section className="bg-black/60 py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <div className="text-jjl-red text-xs font-semibold tracking-[0.2em] uppercase">
            Casos reales
          </div>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold">
            Así aprovecharon la consultoría
          </h2>
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
        <p className="mt-3 text-jjl-muted">45 minutos. Sin costo. Con un coach real.</p>
        <a
          href="#top"
          className="mt-8 inline-flex items-center gap-2 h-12 px-6 bg-jjl-red text-white font-semibold rounded-xl shadow-[0_8px_24px_-8px_rgba(220,38,38,0.5)] hover:bg-jjl-red-hover transition-colors"
        >
          RESERVAR MI CONSULTORÍA →
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
    <main id="top" className="min-h-screen bg-jjl-dark text-white font-sans">
      <Topbar />
      <Hero />
      <Deliverables />
      <Testimonials />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  );
}

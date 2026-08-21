import type { SalesFaq } from './types';

// Copy estático de la home/catálogo de JJL Cursos. Vive en código porque
// no hay tabla para copy de catálogo (solo los cursos/bundles tienen
// sales_copy en DB). Se edita acá.

export interface CatalogStat {
  valor: string;
  etiqueta: string;
}

export interface CatalogCopy {
  hero: {
    kicker: string;
    headline_l1: string;
    headline_l2: string;
    subheadline: string;
    stats: CatalogStat[];
  };
  metodo: {
    kicker: string;
    titulo: string;
    intro: string;
    pasos: { titulo: string; cuerpo: string }[];
  };
  faqs: SalesFaq[];
  garantia: { titulo: string; cuerpo: string };
  cta_final: { titulo: string; cuerpo: string; boton: string };
}

export const catalogCopy: CatalogCopy = {
  hero: {
    kicker: 'Instruccionales de BJJ en español',
    headline_l1: 'Dejá de coleccionar técnicas',
    headline_l2: 'que no salen en sparring.',
    subheadline:
      'Cada curso incluye las clases en video con material de estudio escrito, un plan de entrenamiento para el tatami y juegos de sparring con resistencia progresiva. Estudiala, entrenala, integrala.',
    stats: [
      { valor: '+200', etiqueta: 'alumnos formados' },
      { valor: '300+', etiqueta: 'lecciones en video' },
      { valor: '2 años', etiqueta: 'de acceso, pago único' },
      { valor: '7 días', etiqueta: 'de garantía total' },
    ],
  },
  metodo: {
    kicker: 'El Sistema Híbrido',
    titulo: 'Mirar videos no hace que la técnica salga en sparring',
    intro:
      'Entre ver una técnica y que te salga contra alguien que se resiste hay un abismo. Por eso acá no vendemos colecciones de videos: cada curso usa el Sistema Híbrido, tres pasos que van del video al tatami, y del tatami al sparring.',
    pasos: [
      {
        titulo: 'Estudiá',
        cuerpo:
          'Cada clase viene con su video y con material de estudio escrito: los detalles clave, los errores comunes y los conceptos de la posición. No dependés de tu memoria ni de volver a mirar el video diez veces.',
      },
      {
        titulo: 'Entrenala',
        cuerpo:
          'Cada módulo trae el Plan Fase 1: un plan de entrenamiento concreto para llevar esa técnica al tatami. Cuando pisás la academia sabés exactamente qué drillear y en qué orden.',
      },
      {
        titulo: 'Integrala',
        cuerpo:
          'El Plan Fase 2 son juegos ecológicos: sparring dirigido con resistencia progresiva, de menos a más. Así la técnica deja de ser un dato en tu cabeza y empieza a salirte contra oponentes reales.',
      },
    ],
  },
  faqs: [
    {
      pregunta: '¿Esto no es lo mismo que mirar videos en YouTube?',
      respuesta:
        'No. Un video te muestra la técnica; el Sistema Híbrido te dice qué hacer con ella. Cada clase incluye material de estudio escrito, cada módulo trae su plan de entrenamiento (Plan Fase 1) y juegos de sparring con resistencia progresiva (Plan Fase 2) para que la técnica te salga contra oponentes reales, no solo en el drill.',
    },
    {
      pregunta: '¿Qué incluye El ADN del Jiu Jitsu?',
      respuesta:
        'Son 4 instruccionales sobre las posiciones fundamentales del jiu jitsu —tres completos y un módulo conceptual de pasaje en expansión— con 170 lecciones en total, más el material de estudio escrito y los planes de entrenamiento de cada módulo. Comprados por separado salen US$ 240; el pack completo cuesta US$ 107.',
    },
    {
      pregunta: 'Soy cinturón blanco, ¿me sirve o es demasiado avanzado?',
      respuesta:
        'Te sirve. Los cursos están pensados para practicantes de blanco a violeta que entrenan en una academia normal. El material escrito y los planes te ordenan el estudio justo en la etapa en la que más información nueva recibís y menos criterio tenés para filtrarla.',
    },
    {
      pregunta: 'Entreno 2 o 3 veces por semana. ¿Me alcanza para aplicar los planes?',
      respuesta:
        'Los planes están armados exactamente para eso: no necesitás entrenar todos los días. El Plan Fase 1 te dice qué drillear en cada visita al tatami, y los juegos del Plan Fase 2 los podés proponer en cualquier sparring u open mat de tu academia.',
    },
    {
      pregunta: '¿Por cuánto tiempo tengo acceso y en qué dispositivos?',
      respuesta:
        'Tenés acceso por 2 años con un solo pago, sin suscripciones ni cargos ocultos. Podés ver las clases y leer el material desde cualquier dispositivo: celular, tablet o computadora.',
    },
    {
      pregunta: '¿Y si lo compro y no es para mí?',
      respuesta:
        'Tenés 7 días de garantía. Si en ese tiempo el curso no te convence, nos escribís y te devolvemos el 100% de tu dinero.',
    },
  ],
  garantia: {
    titulo: '7 días para probarlo. Devolución del 100%.',
    cuerpo:
      'Entrá, mirá las clases, leé el material y llevá el Plan Fase 1 a tu próximo entrenamiento. Si en 7 días decidís que no es para vos, te devolvemos todo tu dinero. El riesgo lo corremos nosotros, no vos.',
  },
  cta_final: {
    titulo: 'Elegí una posición y entrenala en serio',
    cuerpo:
      'Empezá por El ADN del Jiu Jitsu —4 cursos y 170 lecciones sobre las posiciones fundamentales— o por el curso suelto de la posición que más te cuesta. Pago único, acceso por 2 años y 7 días de garantía total.',
    boton: 'Ver el pack El ADN del Jiu Jitsu',
  },
};

// FAQ compartido entre /consultoria-gratuita y /ads. Las preguntas son las
// mismas (mismo programa, mismas objeciones del target +30) — no duplicar.

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_CONSULTORIA: FaqItem[] = [
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

-- ============================================
-- JJL CURSOS — seed de secciones + lecciones (Front Headlock)
-- ============================================
-- Pobla un curso con estructura real para probar el visor.
-- Idempotente: borra y reinserta las secciones de Front Headlock.
-- Los youtube_id son un video público de prueba (Big Buck Bunny);
-- se reemplazan por los reales en la migración (F4).

-- Limpiar secciones previas de Front Headlock (cascada borra lecciones)
DELETE FROM public.cursos_sections
WHERE course_id = (SELECT id FROM public.cursos_courses WHERE slug = 'front-headlock');

-- Secciones
INSERT INTO public.cursos_sections (course_id, titulo, descripcion, orden)
SELECT c.id, x.titulo, x.descripcion, x.orden
FROM public.cursos_courses c
JOIN (VALUES
  ('3 Puntos de Contacto', 'La base del control frontal de cabeza.', 1),
  ('Estrangulaciones', 'Finalizaciones desde la posición.', 2),
  ('Toma de Espalda', 'Transición a una de las mejores posiciones.', 3)
) AS x(titulo, descripcion, orden) ON true
WHERE c.slug = 'front-headlock';

-- Lecciones
INSERT INTO public.cursos_lessons
  (section_id, course_id, tipo, titulo, youtube_id, contenido, duracion, orden)
SELECT s.id, s.course_id, x.tipo, x.titulo,
       NULLIF(x.youtube_id, ''), NULLIF(x.contenido, ''), NULLIF(x.duracion, ''), x.orden
FROM public.cursos_sections s
JOIN public.cursos_courses c ON c.id = s.course_id AND c.slug = 'front-headlock'
JOIN (VALUES
  ('3 Puntos de Contacto', 'video', 'Conceptos del módulo y objetivos', 'aqz-KE-bpKQ',
    E'Antes de entrar a las técnicas, fijá el objetivo del módulo: entender por qué el Front Headlock controla y cómo te abre el camino a la finalización.\n\nMirá el video completo una vez sin pausas, y una segunda vez tomando nota de los 3 puntos de contacto.',
    '01:20', 1),
  ('3 Puntos de Contacto', 'video', 'Foto de la posición y material de estudio', 'aqz-KE-bpKQ',
    E'Los 3 puntos de contacto:\n\n1. Mano a la pera — evita que el oponente se mueva hacia atrás.\n2. Hombro a la nuca — evita que avance hacia adelante; se coloca en la curvatura de la nuca.\n3. Mano en el codo — controla los movimientos laterales.\n\nTip clave: cerrá los codos y traccioná constantemente, llevando el codo hacia tu cadera.',
    '01:54', 2),
  ('3 Puntos de Contacto', 'video', 'Direcciones de ataque', 'aqz-KE-bpKQ',
    E'Desde el control, tenés tres direcciones de ataque posibles. En esta clase vemos cómo leer la reacción del oponente para elegir cuál.',
    '00:48', 3),
  ('3 Puntos de Contacto', 'texto', 'Plan de entrenamiento del módulo 1', '',
    E'Objetivo de la semana: lograr y mantener los 3 puntos de contacto en rolling en vivo.\n\nJuego ecológico: tu compañero intenta salir; vos solo tenés que mantener los 3 contactos durante 60 segundos. Sin atacar todavía.\n\nRepetí el drill 5 rondas por lado.',
    '', 4),
  ('Estrangulaciones', 'video', 'Anaconda: mecánica básica', 'aqz-KE-bpKQ',
    E'La anaconda surge naturalmente del Front Headlock. Acá vemos el cierre del mata-león y cómo rotar para finalizar.',
    '02:10', 1),
  ('Estrangulaciones', 'video', 'Guillotina desde el control frontal', 'aqz-KE-bpKQ',
    E'Cuando el oponente levanta la cabeza, la guillotina aparece. Detalle del agarre y la palanca.',
    '01:35', 2),
  ('Estrangulaciones', 'video', 'Encadenar las dos amenazas', 'aqz-KE-bpKQ',
    E'El dilema: si defiende la anaconda, le das la guillotina, y viceversa. Acá se arma el sistema.',
    '01:50', 3),
  ('Toma de Espalda', 'video', 'Llegar a la espalda desde el frente', 'aqz-KE-bpKQ',
    E'Si el oponente gira para escapar, le damos la espalda. Timing y colocación de los ganchos.',
    '02:05', 1),
  ('Toma de Espalda', 'video', 'Mata-león desde la espalda', 'aqz-KE-bpKQ',
    E'Una vez en la espalda, la finalización más directa. Detalles del cierre.',
    '01:40', 2)
) AS x(seccion, tipo, titulo, youtube_id, contenido, duracion, orden)
  ON x.seccion = s.titulo;

-- Accesos de prueba: todos los admin acceden a todos los cursos (vitalicio).
-- Permite probar el visor y "Mis cursos" sin checkout.
INSERT INTO public.cursos_access (user_id, course_id, granted_by, expires_at, notas)
SELECT u.id, c.id, u.id, NULL, 'acceso admin (seed de prueba)'
FROM public.users u
CROSS JOIN public.cursos_courses c
WHERE u.rol = 'admin'
ON CONFLICT (user_id, course_id) DO NOTHING;

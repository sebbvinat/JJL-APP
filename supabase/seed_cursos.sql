-- ============================================
-- JJL CURSOS — seed inicial del catálogo
-- ============================================
-- Carga los cursos reales para poblar el catálogo y verificar el diseño.
-- Idempotente: re-correrlo actualiza por slug. Los precios/instructores
-- salen del WordPress actual. La estructura de lecciones (secciones +
-- youtube_id) y los vencimientos exactos se cargan en la migración (F4).

-- ---------- Cursos (sub-cursos del ADN + sueltos) ----------
INSERT INTO public.cursos_courses
  (slug, titulo, subtitulo, descripcion, instructor, precio, precio_label,
   nivel, publicado, orden, duracion_acceso_meses, sales_copy)
VALUES
  ('fundamento-adn-control-finalizacion',
   'Fundamento ADN: Control y Finalización',
   'Asegurá el control y aumentá tu porcentaje de finalizaciones.',
   'Los conceptos clave para controlar a tu oponente y terminar la lucha.',
   'Jiu Jitsu Latino', 60, 'US$ 60', 'Fundamentos', true, 1, 24,
   '{"subheadline":"Del control a la finalización, sin coleccionar técnicas que se olvidan."}'::jsonb),

  ('fundamento-adn-guardia',
   'Fundamento ADN: Guardia',
   'Construí una guardia sólida que ofenda y no solo defienda.',
   'Fundamentos para jugar y atacar desde la guardia.',
   'Jiu Jitsu Latino', 60, 'US$ 60', 'Fundamentos', true, 2, 24,
   '{"subheadline":"Una guardia que genera dilemas, no que solo aguanta."}'::jsonb),

  ('fundamento-adn-escapes',
   'Fundamento ADN: Escapes',
   'Salí de las peores posiciones con un sistema claro.',
   'Escapes de las posiciones más difíciles del Jiu-Jitsu.',
   'Jiu Jitsu Latino', 60, 'US$ 60', 'Fundamentos', true, 3, 24,
   '{"subheadline":"Dejá de quedar aplastado: un mapa para escapar y recuperar."}'::jsonb),

  ('fundamento-adn-pasaje-de-guardia',
   'Fundamento ADN: Pasaje de Guardia',
   'Pasá la guardia con presión y llegá a posiciones dominantes.',
   'Fundamentos del pasaje de guardia con conceptos repetibles.',
   'Jiu Jitsu Latino', 60, 'US$ 60', 'Fundamentos', true, 4, 24,
   '{"subheadline":"Pasar la guardia con presión y un plan, no a la fuerza."}'::jsonb),

  ('front-headlock',
   'Front Headlock',
   'Domina el control frontal de cabeza: de la posición a la finalización.',
   'Aprende a finalizar rápidamente y a transicionar a posiciones dominantes desde el front headlock.',
   'Lalo García Morato', 47, 'US$ 47', 'No Gi', true, 1, 24,
   '{"subheadline":"Del desgaste a la finalización: un sistema completo de Front Headlock.","solucion":[{"titulo":"Los 3 puntos de contacto","cuerpo":"Aprendés a controlar a tu oponente con un sistema de agarres que limita cada una de sus salidas."},{"titulo":"Estrangulaciones y toma de espalda","cuerpo":"Cómo encadenar amenazas para finalizar o llegar a la espalda desde la posición."}],"highlights":["3 puntos de contacto","Estrangulaciones","Toma de espalda","Juegos ecológicos"],"garantia":{"titulo":"Garantía de 7 días","cuerpo":"Probá el curso 7 días. Si no es para vos, te devolvemos el 100%."},"faqs":[{"pregunta":"¿Por cuánto tiempo tengo acceso?","respuesta":"Tenés acceso a la plataforma durante 2 años desde la compra."},{"pregunta":"¿Sirve si entreno con kimono?","respuesta":"Sí. Los conceptos son de No Gi pero se trasladan al juego con kimono."}]}'::jsonb),

  ('retencion-de-guardia',
   'Retención de Guardia',
   'Los fundamentos para mantener la guardia, evitar pasajes y crear oportunidades.',
   'Domina los fundamentos para mantener la guardia y evitar pasajes desde la posición inferior.',
   'Facundo Ciancio', 65, 'US$ 65', 'No Gi', true, 2, 24,
   '{"subheadline":"Dejá de que te pasen la guardia: retené, recuperá y contraatacá.","highlights":["Marcos y distancia","Recuperación de guardia","Contraataques"],"garantia":{"titulo":"Garantía de 7 días","cuerpo":"Probá el curso 7 días. Si no es para vos, te devolvemos el 100%."}}'::jsonb),

  ('escapes-de-la-espalda',
   'Escapes de la Espalda',
   'Aumentá tus probabilidades de escape desde una de las posiciones más dominantes.',
   'La espalda es una de las posiciones más dominantes del Jiu-Jitsu: aprendé a escapar, recuperar el control y contraatacar.',
   'Jiu Jitsu Latino', 34, 'US$ 34', 'No Gi', true, 3, 24,
   '{"subheadline":"Un sistema claro para salir de la espalda antes de que sea tarde.","highlights":["Defensa del cuello","Escape y recuperación","Contraataques"],"garantia":{"titulo":"Garantía de 7 días","cuerpo":"Probá el curso 7 días. Si no es para vos, te devolvemos el 100%."}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  subtitulo = EXCLUDED.subtitulo,
  descripcion = EXCLUDED.descripcion,
  instructor = EXCLUDED.instructor,
  precio = EXCLUDED.precio,
  precio_label = EXCLUDED.precio_label,
  nivel = EXCLUDED.nivel,
  publicado = EXCLUDED.publicado,
  orden = EXCLUDED.orden,
  duracion_acceso_meses = EXCLUDED.duracion_acceso_meses,
  sales_copy = EXCLUDED.sales_copy;

-- ---------- Bundle: El ADN del Jiu Jitsu ----------
INSERT INTO public.cursos_bundles
  (slug, titulo, subtitulo, precio, precio_label, publicado, orden,
   duracion_acceso_meses, sales_copy)
VALUES
  ('el-adn-del-jiu-jitsu',
   'El ADN del Jiu Jitsu',
   'Las técnicas vitales de las cuatro posiciones fundamentales del Jiu-Jitsu, en un solo programa con sistema de entrenamiento.',
   107, 'US$ 107', true, 1, 24,
   '{"subheadline":"4 instruccionales fundamentales en un solo pack, con el Sistema Híbrido de entrenamiento.","highlights":["Control y Finalización","Guardia","Escapes","Pasaje de Guardia"],"garantia":{"titulo":"Garantía de 7 días","cuerpo":"Probá el programa 7 días. Si no es para vos, te devolvemos el 100%."}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  subtitulo = EXCLUDED.subtitulo,
  precio = EXCLUDED.precio,
  precio_label = EXCLUDED.precio_label,
  publicado = EXCLUDED.publicado,
  orden = EXCLUDED.orden,
  duracion_acceso_meses = EXCLUDED.duracion_acceso_meses,
  sales_copy = EXCLUDED.sales_copy;

-- ---------- Items del bundle ADN (resuelve ids por slug) ----------
INSERT INTO public.cursos_bundle_items (bundle_id, course_id, orden)
SELECT b.id, c.id, x.orden
FROM public.cursos_bundles b
JOIN (
  VALUES
    ('fundamento-adn-control-finalizacion', 1),
    ('fundamento-adn-guardia', 2),
    ('fundamento-adn-escapes', 3),
    ('fundamento-adn-pasaje-de-guardia', 4)
) AS x(slug, orden) ON true
JOIN public.cursos_courses c ON c.slug = x.slug
WHERE b.slug = 'el-adn-del-jiu-jitsu'
ON CONFLICT (bundle_id, course_id) DO UPDATE SET orden = EXCLUDED.orden;

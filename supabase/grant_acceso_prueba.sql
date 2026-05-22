-- ============================================
-- JJL CURSOS — grant de acceso de prueba
-- ============================================
-- Le da acceso vitalicio a TODOS los cursos a una cuenta puntual,
-- para poder probar "Mis cursos" y el visor sin pasar por el checkout.
-- Cambiá el email si querés habilitar a otra persona.

INSERT INTO public.cursos_access (user_id, course_id, granted_by, expires_at, notas)
SELECT u.id, c.id, u.id, NULL, 'acceso de prueba'
FROM public.users u
CROSS JOIN public.cursos_courses c
WHERE u.email = 'jiujitsulat@gmail.com'
ON CONFLICT (user_id, course_id) DO NOTHING;

-- Verificación: tiene que listar los cursos habilitados para esa cuenta.
SELECT u.email, c.titulo, a.expires_at
FROM public.cursos_access a
JOIN public.users u ON u.id = a.user_id
JOIN public.cursos_courses c ON c.id = a.course_id
WHERE u.email = 'jiujitsulat@gmail.com';

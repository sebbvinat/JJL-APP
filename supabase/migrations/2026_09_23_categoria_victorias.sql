-- Comunidad: agregar la categoria "Victorias".
--
-- POR QUE HACE FALTA CORRER ESTO
-- La tabla "posts" tiene un CHECK (posts_categoria_check) con la lista de
-- categorias permitidas. Hoy acepta: question, technique, progress, discussion,
-- competition, offtopic, bienvenida. "victorias" NO esta, asi que hasta que esto
-- no corra, el que elija "Victorias" en la app va a recibir un error al publicar.
--
-- QUE HACE
-- No reescribe la lista a mano (no quiero borrarte sin querer una categoria que
-- ya estuviera permitida): lee el CHECK que hay HOY y le agrega 'victorias'.
-- Si algo no sale como se espera, corta y no deja la tabla a medias.
--
-- Se puede correr dos veces: la segunda no hace nada.

do $$
declare
  def_vieja text;
  def_nueva text;
begin
  select pg_get_constraintdef(oid) into def_vieja
  from pg_constraint
  where conrelid = 'public.posts'::regclass
    and conname = 'posts_categoria_check';

  if def_vieja is null then
    raise exception 'No encontre el check posts_categoria_check en la tabla posts. No toco nada.';
  end if;

  if position('''victorias''' in def_vieja) > 0 then
    raise notice 'La categoria victorias ya estaba permitida. No hago nada.';
    return;
  end if;

  -- Postgres guarda la lista siempre como: CHECK ((categoria = ANY (ARRAY['x'::text, ...])))
  -- Le metemos 'victorias' como primer elemento del ARRAY.
  def_nueva := replace(def_vieja, 'ARRAY[', 'ARRAY[''victorias''::text, ');

  if def_nueva = def_vieja then
    raise exception 'El check no tiene la forma esperada (%). Avisame y lo hago a mano.', def_vieja;
  end if;

  execute 'alter table public.posts drop constraint posts_categoria_check';
  execute 'alter table public.posts add constraint posts_categoria_check ' || def_nueva;

  -- Verificacion: si por lo que sea no quedo, la excepcion deshace todo.
  select pg_get_constraintdef(oid) into def_nueva
  from pg_constraint
  where conrelid = 'public.posts'::regclass and conname = 'posts_categoria_check';
  if position('''victorias''' in def_nueva) = 0 then
    raise exception 'Quedo mal: el check nuevo no tiene victorias (%).', def_nueva;
  end if;

  raise notice 'Listo. Check nuevo: %', def_nueva;
end $$;

-- Para mirar como quedo:
-- select pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.posts'::regclass and conname = 'posts_categoria_check';

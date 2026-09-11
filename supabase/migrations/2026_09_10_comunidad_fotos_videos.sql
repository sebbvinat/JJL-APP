-- Fotos y videos en los posts de la comunidad.
--
-- Fotos: se suben al bucket `avatars` bajo comunidad/<user_id>/..., igual que
-- las fotos del chat. Se comprimen en el celular antes de subir (lado mayor
-- 1600px, JPEG): una foto de 4 MB queda en ~300 KB. Importa porque el plan
-- gratis de Supabase tiene ~5 GB de trafico al mes COMPARTIDO con los avatares
-- y el chat; fotos crudas en un feed que todos miran lo agotaban rapido.
--
-- Videos: NO se suben. Se pega el link (YouTube, Instagram, Vimeo) y se
-- muestra embebido. Un video de 2 minutos pesa lo que 300 fotos; subirlos
-- rompia el mismo limite en una semana, y ademas esas plataformas ya resuelven
-- la reproduccion en celulares lentos mucho mejor que un <video> nuestro.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS imagen_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

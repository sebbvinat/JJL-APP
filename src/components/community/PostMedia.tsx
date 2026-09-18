'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { videoEmbedDe, NOMBRE_PLATAFORMA, type VideoEmbed } from '@/lib/video-embed';

/**
 * La foto y/o el video de un post.
 *
 * `compacto` es la version del feed. Ahi el video no arranca embebido: el feed
 * trae hasta 50 posts y un iframe por cada uno hace que la lista tarde una
 * eternidad en un celular. Se muestra la miniatura y el reproductor aparece
 * en el mismo lugar al tocarla, sin salir del feed ni abrir el post.
 */
export default function PostMedia({
  imagenUrl,
  videoUrl,
  compacto = false,
}: {
  imagenUrl?: string | null;
  videoUrl?: string | null;
  compacto?: boolean;
}) {
  const video = videoEmbedDe(videoUrl);
  if (!imagenUrl && !video) return null;

  return (
    <div className="mt-3 space-y-3">
      {imagenUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagenUrl}
          alt=""
          loading="lazy"
          className={
            compacto
              ? 'max-h-80 w-full rounded-xl border border-jjl-border object-cover'
              : 'max-h-[75vh] w-full rounded-xl border border-jjl-border bg-black object-contain'
          }
        />
      )}

      {video && <Video video={video} arrancaCerrado={compacto} />}
    </div>
  );
}

/** YouTube y Drive publican la miniatura de cada video en una URL fija por id. */
function miniaturaDe(video: VideoEmbed): string | null {
  if (video.plataforma === 'youtube') return `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
  if (video.plataforma === 'drive') return `https://drive.google.com/thumbnail?id=${video.id}&sz=w640`;
  return null;
}

/**
 * ¿El video es vertical?
 *
 * YouTube e Instagram lo dicen en el link (shorts, reels). Drive no dice
 * nada, y ahi es donde mas importa: los alumnos filman con el celular, en
 * vertical, y metido en un marco 16:9 el video quedaba como una tira finita
 * entre dos bandas negras enormes. La miniatura de Drive respeta la forma
 * del video, asi que se mide esa. Mientras carga se asume vertical, que es
 * lo que casi siempre sube la gente.
 */
function useVertical(video: VideoEmbed): boolean {
  const esDrive = video.plataforma === 'drive';
  const miniatura = esDrive ? miniaturaDe(video) : null;
  const [driveVertical, setDriveVertical] = useState(true);

  useEffect(() => {
    if (!miniatura) return;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setDriveVertical(img.naturalHeight > img.naturalWidth);
      }
    };
    img.src = miniatura;
    return () => {
      img.onload = null;
    };
  }, [miniatura]);

  return esDrive ? driveVertical : video.vertical;
}

/**
 * Miniatura hasta que la tocan, reproductor despues, siempre en el mismo
 * marco para que no salte nada al darle play.
 *
 * Los clicks no pueden burbujear: en el feed la tarjeta entera es un link al
 * post, y si dejamos pasar el evento, tocar play te saca del feed en vez de
 * reproducir.
 */
function Video({ video, arrancaCerrado }: { video: VideoEmbed; arrancaCerrado: boolean }) {
  const [reproduciendo, setReproduciendo] = useState(!arrancaCerrado);
  const vertical = useVertical(video);
  const miniatura = miniaturaDe(video);
  const nombre = NOMBRE_PLATAFORMA[video.plataforma];

  // Vertical: ancho de celular, pero nunca mas alto que el 75% de la
  // pantalla (el ancho se saca de ese alto) para que se vea entero sin
  // scrollear. Horizontal: todo el ancho, 16:9.
  const marco = `overflow-hidden rounded-xl border border-jjl-border bg-black ${
    vertical
      ? 'mx-auto aspect-[9/16] w-[min(100%,340px,calc(75vh*9/16))]'
      : 'aspect-video w-full'
  }`;

  const frenar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (reproduciendo) {
    return (
      <div onClick={frenar} className={marco}>
        <iframe
          src={arrancaCerrado ? conAutoplay(video) : video.embedUrl}
          title={`Video de ${nombre}`}
          className="h-full w-full"
          loading={arrancaCerrado ? undefined : 'lazy'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  // Sin miniatura (Instagram, Vimeo) no hay de donde sacar una imagen: un
  // aviso chico en vez de un marco negro vacio del tamaño del video.
  if (!miniatura) {
    return (
      <button
        type="button"
        onClick={(e) => {
          frenar(e);
          setReproduciendo(true);
        }}
        className="flex w-full items-center gap-2.5 rounded-xl border border-jjl-border bg-white/[0.03] px-3.5 py-3 text-left"
        aria-label={`Reproducir el video de ${nombre}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jjl-red">
          <Play className="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" />
        </span>
        <span className="text-[13px] font-semibold text-white">Video de {nombre}</span>
        <span className="ml-auto text-[12px] text-jjl-muted">Tocá para verlo</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        frenar(e);
        setReproduciendo(true);
      }}
      className={`relative block ${marco}`}
      aria-label={`Reproducir el video de ${nombre}`}
    >
      {/* Drive redirige la miniatura a googleusercontent, que la rechaza si el
          pedido trae de referencia otro sitio: sin esto el cuadro queda negro. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={miniatura}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover opacity-85"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jjl-red shadow-[0_8px_24px_-6px_rgba(220,38,38,0.9)]">
          <Play className="ml-0.5 h-6 w-6 text-white" fill="currentColor" />
        </span>
      </span>
    </button>
  );
}

/**
 * Si ya tocaron play, que el video arranque solo. YouTube y Vimeo lo aceptan
 * por parametro; Instagram y Drive no, asi que ahi queda el play del propio
 * reproductor (un toque mas, pero sin salir del feed).
 */
function conAutoplay(video: VideoEmbed): string {
  if (video.plataforma === 'youtube') return `${video.embedUrl}?autoplay=1&rel=0`;
  if (video.plataforma === 'vimeo') return `${video.embedUrl}?autoplay=1`;
  return video.embedUrl;
}

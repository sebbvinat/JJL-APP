'use client';

import { Play } from 'lucide-react';
import { videoEmbedDe, NOMBRE_PLATAFORMA, type Plataforma } from '@/lib/video-embed';

/**
 * La foto y/o el video de un post.
 *
 * `compacto` es la version del feed. Ahi el video NO se embebe: el feed trae
 * hasta 50 posts y un iframe de Instagram por cada uno hace que la lista tarde
 * una eternidad en un celular. Se muestra la miniatura (YouTube la da gratis)
 * o un aviso de que hay video, y se reproduce al abrir el post.
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

      {video && compacto && <MiniaturaVideo plataforma={video.plataforma} id={video.id} />}

      {video && !compacto && (
        <div
          className={`overflow-hidden rounded-xl border border-jjl-border bg-black ${
            video.vertical ? 'mx-auto aspect-[9/16] max-w-[360px]' : 'aspect-video w-full'
          }`}
        >
          <iframe
            src={video.embedUrl}
            title={`Video de ${NOMBRE_PLATAFORMA[video.plataforma]}`}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

function MiniaturaVideo({ plataforma, id }: { plataforma: Plataforma; id: string }) {
  // YouTube y Drive publican la miniatura de cada video en una URL fija por id.
  const miniatura =
    plataforma === 'youtube'
      ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
      : plataforma === 'drive'
        ? `https://drive.google.com/thumbnail?id=${id}&sz=w640`
        : null;
  if (miniatura) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-jjl-border bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={miniatura}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover opacity-85"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-jjl-red shadow-[0_8px_24px_-6px_rgba(220,38,38,0.9)]">
            <Play className="ml-0.5 h-5 w-5 text-white" fill="currentColor" />
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-jjl-border bg-white/[0.03] px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jjl-red">
        <Play className="ml-0.5 h-3.5 w-3.5 text-white" fill="currentColor" />
      </span>
      <span className="text-[13px] font-semibold text-white">Video de {NOMBRE_PLATAFORMA[plataforma]}</span>
      <span className="ml-auto text-[12px] text-jjl-muted">Abrí el post para verlo</span>
    </div>
  );
}

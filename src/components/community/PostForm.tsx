'use client';

import { useRef, useState } from 'react';
import { X, BarChart3, Plus, ImagePlus, Video, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { comprimirImagen } from '@/lib/comprimir-imagen';
import { videoEmbedDe } from '@/lib/video-embed';

interface PostFormProps {
  onClose: () => void;
  /** Devuelve false si NO se pudo publicar — el modal queda abierto con el
   *  texto para reintentar en vez de descartarlo. */
  onSubmit: (data: {
    titulo: string;
    contenido: string;
    categoria: string;
    poll?: { pregunta: string; opciones: string[]; multiple: boolean };
    imagen_url?: string;
    video_url?: string;
  }) => void | boolean | Promise<void | boolean>;
}

const CATEGORIES = [
  { value: 'question', label: 'Pregunta' },
  // Solo cambia la etiqueta: por dentro sigue siendo 'technique' para no
  // dejar huerfanos los posts ya publicados con esa categoria.
  { value: 'technique', label: 'Subí tu treino' },
  { value: 'progress', label: 'Progreso' },
  { value: 'discussion', label: 'Discusion' },
  { value: 'competition', label: 'Competencia' },
  { value: 'bienvenida', label: 'Bienvenida' },
  { value: 'offtopic', label: 'Off Topic' },
];

export default function PostForm({ onClose, onSubmit }: PostFormProps) {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoria, setCategoria] = useState('discussion');

  // Foto: se sube apenas la elige, asi ve la vista previa antes de publicar.
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const inputFoto = useRef<HTMLInputElement>(null);

  // Video: solo el link. No se sube (ver migracion 2026_09_10).
  const [videoAbierto, setVideoAbierto] = useState(false);
  const [videoLink, setVideoLink] = useState('');
  const videoValido = videoEmbedDe(videoLink);
  const videoConError = videoLink.trim().length > 0 && !videoValido;

  // Poll state
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Un post de "Subí tu treino" puede ser solo la foto o el video con un
  // titulo: no le pedimos que invente un texto para poder publicar.
  const tieneMedia = !!imagenUrl || !!videoValido;
  const puedePublicar =
    titulo.trim().length > 0 && (contenido.trim().length > 0 || tieneMedia) && !subiendoFoto && !videoConError;

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto si la saca
    if (!archivo) return;
    setErrorFoto('');
    setSubiendoFoto(true);
    try {
      const liviana = await comprimirImagen(archivo);
      const fd = new FormData();
      fd.append('image', liviana);
      const res = await fetch('/api/community/image', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo subir la foto');
      setImagenUrl(data.url);
    } catch (err) {
      setErrorFoto(err instanceof Error ? err.message : 'No se pudo subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedePublicar || submitting) return;

    let poll: { pregunta: string; opciones: string[]; multiple: boolean } | undefined;
    if (pollEnabled && pollQuestion.trim()) {
      const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length >= 2) {
        poll = { pregunta: pollQuestion.trim(), opciones: cleanOpts, multiple: pollMultiple };
      }
    }

    // Esperamos la confirmación antes de cerrar. Antes se llamaba a onSubmit y
    // se cerraba en la misma línea: si fallaba la red, el alumno perdía el post
    // entero (escrito en el celular) y solo veía un toast rojo.
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        titulo,
        contenido,
        categoria,
        poll,
        imagen_url: imagenUrl || undefined,
        video_url: videoValido ? videoLink.trim() : undefined,
      });
      if (ok !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-jjl-gray border border-jjl-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-jjl-border sticky top-0 bg-jjl-gray z-10">
          <h2 className="text-lg font-bold">Nuevo Post</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-jjl-gray-light text-jjl-muted hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            id="titulo"
            label="Titulo"
            placeholder="De que quieres hablar?"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-jjl-muted mb-1.5">
              Contenido{tieneMedia && <span className="text-jjl-muted/60"> (opcional)</span>}
            </label>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Comparte tu experiencia, duda o tecnica..."
              className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-3 text-white text-base placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 focus:ring-jjl-red/50 focus:border-jjl-red transition-colors resize-none h-32"
            />
          </div>

          {/* ── Foto y video ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            {imagenUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagenUrl}
                  alt="Vista previa"
                  className="max-h-72 w-full rounded-xl border border-jjl-border bg-black object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImagenUrl(null)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black"
                  aria-label="Sacar la foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {videoAbierto && (
              <div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={videoLink}
                    onChange={(e) => setVideoLink(e.target.value)}
                    placeholder="Pegá el link de YouTube, Instagram o Vimeo"
                    className={`flex-1 rounded-lg border bg-jjl-gray-light px-3.5 py-2.5 text-base text-white placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 ${
                      videoConError
                        ? 'border-jjl-red focus:ring-jjl-red/40'
                        : 'border-jjl-border focus:border-jjl-red focus:ring-jjl-red/40'
                    }`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setVideoAbierto(false); setVideoLink(''); }}
                    className="p-2 text-jjl-muted hover:text-red-400"
                    aria-label="Sacar el video"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {videoConError && (
                  <p className="mt-1.5 text-[12.5px] text-jjl-red">
                    Ese link no es de YouTube, Instagram o Vimeo. Copialo desde el botón Compartir del video.
                  </p>
                )}
                {videoValido && (
                  <p className="mt-1.5 text-[12.5px] text-green-400">Video de {videoValido.plataforma === 'youtube' ? 'YouTube' : videoValido.plataforma === 'instagram' ? 'Instagram' : 'Vimeo'} listo.</p>
                )}
              </div>
            )}

            {errorFoto && <p className="text-[12.5px] text-jjl-red">{errorFoto}</p>}

            <div className="flex flex-wrap gap-2">
              {!imagenUrl && (
                <button
                  type="button"
                  onClick={() => inputFoto.current?.click()}
                  disabled={subiendoFoto}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-jjl-border bg-jjl-gray-light px-4 text-sm font-medium text-jjl-muted transition-colors hover:text-white disabled:opacity-60"
                >
                  {subiendoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {subiendoFoto ? 'Subiendo foto…' : 'Agregar foto'}
                </button>
              )}
              {!videoAbierto && (
                <button
                  type="button"
                  onClick={() => setVideoAbierto(true)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-jjl-border bg-jjl-gray-light px-4 text-sm font-medium text-jjl-muted transition-colors hover:text-white"
                >
                  <Video className="h-4 w-4" />
                  Agregar video
                </button>
              )}
            </div>
            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
              onChange={elegirFoto}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-jjl-muted mb-1.5">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategoria(cat.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[40px] ${
                    categoria === cat.value
                      ? 'bg-jjl-red text-white'
                      : 'bg-jjl-gray-light border border-jjl-border text-jjl-muted hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Poll toggle */}
          <div className="border-t border-jjl-border pt-4">
            {!pollEnabled ? (
              <button
                type="button"
                onClick={() => setPollEnabled(true)}
                className="flex items-center gap-2 text-sm text-jjl-muted hover:text-jjl-red font-medium"
              >
                <BarChart3 className="h-4 w-4" />
                Agregar encuesta
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-jjl-gray-light/30 border border-jjl-border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-jjl-red" /> Encuesta
                  </span>
                  <button
                    type="button"
                    onClick={() => { setPollEnabled(false); setPollQuestion(''); setPollOptions(['','']); }}
                    className="text-xs text-jjl-muted hover:text-red-400"
                  >
                    Quitar
                  </button>
                </div>

                <Input
                  id="poll-q"
                  label="Pregunta"
                  placeholder="Que preferis?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                />

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-jjl-muted mb-1.5">
                    Opciones (min 2)
                  </label>
                  <div className="space-y-2">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const arr = [...pollOptions];
                            arr[i] = e.target.value;
                            setPollOptions(arr);
                          }}
                          placeholder={`Opcion ${i + 1}`}
                          className="flex-1 bg-white/[0.03] border border-jjl-border rounded-lg px-3 py-2.5 text-base text-white placeholder:text-jjl-muted/50 focus:outline-none focus:border-jjl-red"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                            className="p-2 text-jjl-muted hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {pollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="mt-2 text-xs text-jjl-red hover:text-jjl-red-hover font-semibold flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Agregar opcion
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pollMultiple}
                    onChange={(e) => setPollMultiple(e.target.checked)}
                    className="accent-jjl-red"
                  />
                  <span>Permitir multiple respuesta</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={!puedePublicar || submitting}>
              {subiendoFoto ? 'Esperá la foto…' : 'Publicar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

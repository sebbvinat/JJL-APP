'use client';

import { useState } from 'react';
import { X, BarChart3, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PostFormProps {
  onClose: () => void;
  onSubmit: (data: {
    titulo: string;
    contenido: string;
    categoria: string;
    poll?: { pregunta: string; opciones: string[]; multiple: boolean };
  }) => void;
}

const CATEGORIES = [
  { value: 'question', label: 'Pregunta' },
  { value: 'technique', label: 'Tecnica' },
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

  // Poll state
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !contenido.trim()) return;

    let poll: { pregunta: string; opciones: string[]; multiple: boolean } | undefined;
    if (pollEnabled && pollQuestion.trim()) {
      const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length >= 2) {
        poll = { pregunta: pollQuestion.trim(), opciones: cleanOpts, multiple: pollMultiple };
      }
    }

    onSubmit({ titulo, contenido, categoria, poll });
    onClose();
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
            <label className="block text-sm font-medium text-jjl-muted mb-1.5">Contenido</label>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Comparte tu experiencia, duda o tecnica..."
              className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-3 text-white text-base placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 focus:ring-jjl-red/50 focus:border-jjl-red transition-colors resize-none h-32"
              required
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
            <Button type="submit" className="flex-1">
              Publicar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

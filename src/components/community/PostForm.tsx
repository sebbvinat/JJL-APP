'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PostFormProps {
  onClose: () => void;
  onSubmit: (data: { titulo: string; contenido: string; categoria: string }) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !contenido.trim()) return;
    onSubmit({ titulo, contenido, categoria });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-jjl-gray border border-jjl-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-jjl-border">
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

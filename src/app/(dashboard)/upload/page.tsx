'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import UploadDropzone from '@/components/upload/UploadDropzone';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ fileName: string; webViewLink: string } | null>(null);
  const [error, setError] = useState('');

  // Simulate progress animation
  useEffect(() => {
    if (!uploading) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) { clearInterval(interval); return 95; }
        return p + Math.random() * 15;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [uploading]);

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userName', 'Carlos Martinez'); // TODO: use real user
      formData.append('titulo', titulo);
      formData.append('descripcion', descripcion);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      // Handle non-JSON responses (e.g. "Request Entity Too Large")
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 413
            ? 'El archivo es demasiado grande. Limite: 50MB'
            : text || 'Error al subir'
        );
      }

      if (!res.ok) {
        throw new Error(data.error || 'Error al subir');
      }

      setProgress(100);
      setTimeout(() => {
        setResult({ fileName: data.fileName, webViewLink: data.webViewLink });
        setUploading(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo');
      setUploading(false);
      setProgress(0);
    }
  };

  const reset = () => {
    setFile(null);
    setTitulo('');
    setDescripcion('');
    setTags('');
    setResult(null);
    setProgress(0);
    setError('');
  };

  if (result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 max-w-lg mx-auto">
        <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Video Subido Exitosamente</h2>
        <p className="text-jjl-muted text-center">
          Tu video <span className="text-white font-medium">{result.fileName}</span> se subio correctamente a Google Drive.
        </p>
        {result.webViewLink && result.webViewLink !== '#' && (
          <a
            href={result.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-jjl-red hover:underline text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Ver en Google Drive
          </a>
        )}
        <Button onClick={reset}>Subir otro video</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Subir Video de Lucha</h1>
        <p className="text-jjl-muted mt-1">Sube tus videos para revision y feedback personalizado</p>
      </div>

      {/* Dropzone */}
      <Card>
        <UploadDropzone file={file} onFileSelect={setFile} />
      </Card>

      {file && (
        <>
          {/* Metadata */}
          <Card>
            <div className="space-y-4">
              <Input
                id="titulo"
                label="Titulo del video"
                placeholder="Ej: Lucha en torneo local — semifinal"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-jjl-muted mb-1.5">
                  Descripcion
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full bg-jjl-gray-light border border-jjl-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-jjl-muted/60 focus:outline-none focus:ring-2 focus:ring-jjl-red/50 focus:border-jjl-red transition-colors resize-none h-24"
                  placeholder="Describe brevemente el contexto: torneo, sparring, tecnica que intentaste..."
                />
              </div>
              <Input
                id="tags"
                label="Tags"
                placeholder="torneo, guardia, pase (separados por coma)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </Card>

          {/* Progress */}
          {uploading && (
            <Card>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-jjl-muted">Subiendo a Google Drive...</span>
                  <span className="text-jjl-red font-medium">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-jjl-gray-light rounded-full h-2.5">
                  <div
                    className="bg-jjl-red h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleUpload}
            loading={uploading}
            disabled={uploading}
          >
            Subir Video a Google Drive
          </Button>
        </>
      )}
    </div>
  );
}

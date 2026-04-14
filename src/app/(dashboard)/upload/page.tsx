'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ExternalLink, Upload as UploadIcon } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import UploadDropzone from '@/components/upload/UploadDropzone';
import { useToast } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ fileName: string; webViewLink: string } | null>(null);
  const [error, setError] = useState('');
  const toast = useToast();

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
        toast.success('Video subido', 'Listo en Google Drive');
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir el archivo';
      setError(msg);
      setUploading(false);
      setProgress(0);
      logger.error('upload.failed', { err, fileName: file.name, size: file.size });
      toast.error(msg, 'Upload fallo');
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-5 max-w-lg mx-auto">
        <div className="h-24 w-24 bg-green-500/15 rounded-full flex items-center justify-center shadow-lg shadow-green-500/10 animate-[scale-in_0.4s_ease-out]">
          <CheckCircle className="h-12 w-12 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" />
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
            className="flex items-center gap-2 text-jjl-red hover:text-red-400 hover:underline text-sm transition-colors"
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
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-jjl-red/10 ring-1 ring-jjl-red/25 text-jjl-red flex items-center justify-center">
          <UploadIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Subir Video</h1>
          <p className="text-sm text-jjl-muted mt-0.5">Para analisis con tu instructor</p>
        </div>
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
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-jjl-muted">Subiendo a Google Drive...</span>
                  <span className="text-jjl-red font-bold tabular-nums">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-jjl-red to-orange-500 rounded-full transition-all duration-300 shadow-[0_0_12px_-2px_rgba(220,38,38,0.6)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-start gap-2 animate-fade-in">
              <div className="h-4 w-4 rounded-full bg-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-red-300 text-[10px] font-bold">!</span>
              </div>
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

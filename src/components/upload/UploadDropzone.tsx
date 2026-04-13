'use client';

import { useState, useCallback } from 'react';
import { Upload, Film, X } from 'lucide-react';

interface UploadDropzoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export default function UploadDropzone({ file, onFileSelect }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files?.[0]) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  if (file) {
    return (
      <div className="flex items-center gap-4 p-6 bg-jjl-gray-light border border-jjl-border rounded-xl">
        <div className="h-14 w-14 bg-jjl-red/20 rounded-xl flex items-center justify-center shrink-0">
          <Film className="h-7 w-7 text-jjl-red" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{file.name}</p>
          <p className="text-sm text-jjl-muted">
            {(file.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>
        <button
          onClick={() => onFileSelect(null)}
          className="p-2 rounded-lg hover:bg-jjl-gray text-jjl-muted hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
        isDragging
          ? 'border-jjl-red bg-jjl-red/5 shadow-lg shadow-jjl-red/10'
          : 'border-jjl-border hover:border-jjl-red/50 hover:bg-jjl-red/[0.02]'
      }`}
    >
      <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${isDragging ? 'bg-jjl-red/20 scale-110' : 'bg-jjl-gray-light animate-pulse'}`}>
        <Upload className={`h-8 w-8 transition-colors duration-300 ${isDragging ? 'text-jjl-red' : 'text-jjl-muted'}`} />
      </div>
      <p className="font-semibold">Arrastra tu video de lucha aqui</p>
      <p className="text-sm text-jjl-muted mt-1">o haz clic para seleccionar</p>
      <p className="text-xs text-jjl-muted/50 mt-3">MP4, MOV, AVI — hasta 500MB</p>
      <input
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
      />
    </label>
  );
}

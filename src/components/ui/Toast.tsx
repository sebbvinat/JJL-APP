'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

interface ToastContextValue {
  show: (t: Omit<ToastItem, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastKind, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, ...t }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, title) => show({ kind: 'success', message, title }),
      error: (message, title) => show({ kind: 'error', message, title }),
      info: (message, title) => show({ kind: 'info', message, title }),
      warning: (message, title) => show({ kind: 'warning', message, title }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-4 z-[9998] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto animate-slide-in-right flex items-start gap-3 rounded-xl border backdrop-blur-md px-4 py-3 shadow-2xl',
                STYLES[t.kind]
              )}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-sm font-semibold text-white">{t.title}</p>}
                <p className={clsx('text-sm', t.title ? 'text-jjl-muted mt-0.5' : 'text-white')}>
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => remove(t.id)}
                className="opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

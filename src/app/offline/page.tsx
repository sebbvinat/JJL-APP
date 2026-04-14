import { WifiOff } from 'lucide-react';

export const metadata = {
  title: 'Sin conexion — JJL Elite',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-jjl-dark p-6">
      <div className="max-w-md w-full bg-jjl-gray border border-jjl-border rounded-2xl p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-jjl-red/15 border border-jjl-red/30 flex items-center justify-center mb-5">
          <WifiOff className="h-7 w-7 text-jjl-red" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Sin conexion</h1>
        <p className="text-sm text-jjl-muted mb-6">
          No pudimos conectarnos al servidor. Revisa tu internet y reintenta.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-5 py-2 bg-jjl-red hover:bg-jjl-red-hover text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Reintentar
        </a>
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      {/* Admin Header */}
      <header className="h-16 bg-jjl-gray border-b border-jjl-border flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/logo-jjl.png?v=2" alt="JJL" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="text-base font-bold leading-tight">ADMIN PANEL</h1>
            <p className="text-[10px] text-jjl-red tracking-widest uppercase -mt-0.5">Jiu Jitsu Latino</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-jjl-muted hover:text-white transition-colors"
        >
          Volver a la App
        </Link>
      </header>

      <main className="p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}

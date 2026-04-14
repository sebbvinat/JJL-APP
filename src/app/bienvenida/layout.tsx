export const metadata = {
  title: 'Bienvenida — JJL Elite',
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Ambient red glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[640px] w-[640px] rounded-full blur-3xl opacity-25"
        style={{
          background: 'radial-gradient(circle at center, rgba(220,38,38,0.55), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

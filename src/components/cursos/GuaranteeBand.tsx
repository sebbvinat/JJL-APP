// Banda de garantía (risk reversal). Reutilizable en catálogo y páginas
// de venta. Sello + copy — sin humo, la garantía es real: 7 días, 100%.

export default function GuaranteeBand({
  titulo,
  cuerpo,
}: {
  titulo: string;
  cuerpo: string;
}) {
  return (
    <div className="flex flex-col items-start gap-6 rounded-3xl border-2 border-cursos-ink/10 bg-cursos-surface p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-10">
      {/* sello */}
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-cursos-red sm:h-28 sm:w-28">
        <div className="absolute inset-1.5 rounded-full border border-cursos-red/30" />
        <div className="text-center leading-none">
          <div className="font-display text-[26px] font-black tracking-[-0.03em] text-cursos-red sm:text-[30px]">
            7
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cursos-red">
            días de
            <br />
            garantía
          </div>
        </div>
      </div>
      <div>
        <h3 className="font-display text-xl font-extrabold tracking-[-0.02em] text-cursos-ink sm:text-2xl">
          {titulo}
        </h3>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-cursos-ink-soft">
          {cuerpo}
        </p>
      </div>
    </div>
  );
}

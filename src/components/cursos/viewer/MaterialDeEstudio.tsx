// Material de estudio de una lección — debajo del video o como cuerpo
// de una lección de texto. Tema oscuro (visor). Renderiza HTML si el
// contenido lo es; si es texto plano, lo divide en párrafos por dobles
// saltos de línea. Convierte shortcodes [embed]URL[/embed] de WordPress
// a iframes reales (Canva, YouTube, etc.).

function looksLikeHtml(s: string): boolean {
  return /<[a-z][^>]*>/i.test(s) || /\[embed\]/i.test(s);
}

function detectSource(url: string): { label: string; icon: string } {
  if (/canva\.com/i.test(url)) return { label: 'Canva', icon: '🎨' };
  if (/docs\.google\.com/i.test(url)) return { label: 'Google Docs', icon: '📝' };
  if (/drive\.google\.com/i.test(url)) return { label: 'Google Drive', icon: '📁' };
  if (/notion\.so/i.test(url)) return { label: 'Notion', icon: '📓' };
  if (/dropbox\.com/i.test(url)) return { label: 'Dropbox', icon: '📦' };
  if (/instagram\.com/i.test(url)) return { label: 'Instagram', icon: '📷' };
  return { label: 'Recurso', icon: '📎' };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resourceCard(url: string): string {
  const { label, icon } = detectSource(url);
  const safe = escapeAttr(url);
  return (
    `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="resource-card">` +
    `<span class="rc-icon">${icon}</span>` +
    `<span class="rc-body">` +
    `<span class="rc-label">Material · ${label}</span>` +
    `<span class="rc-title">Abrir material adicional</span>` +
    `</span>` +
    `<span class="rc-cta">Abrir →</span>` +
    `</a>`
  );
}

function transformShortcodes(html: string): string {
  return html.replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, (_, raw) => {
    const url = raw.trim();
    if (!url) return '';
    // Videos: embeber inline (tiene sentido visual)
    const yt = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (yt) {
      return `<div class="embed-wrap"><iframe src="https://www.youtube.com/embed/${yt[1]}" loading="lazy" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    }
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) {
      return `<div class="embed-wrap"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" loading="lazy" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
    }
    // Resto (Canva, Drive, Notion, etc.): tarjeta limpia que abre en pestaña nueva
    return resourceCard(url);
  });
}

export default function MaterialDeEstudio({
  contenido,
  label = 'Material de estudio',
}: {
  contenido: string;
  label?: string;
}) {
  if (!contenido || !contenido.trim()) return null;

  return (
    <section className="mt-8 border-t border-jjl-border pt-8">
      <span className="inline-flex items-center gap-2 rounded-full bg-jjl-red/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-jjl-red-soft">
        {label}
      </span>
      <div className="mt-5 max-w-2xl">
        {looksLikeHtml(contenido) ? (
          <div
            className="cursos-rich"
            dangerouslySetInnerHTML={{ __html: transformShortcodes(contenido) }}
          />
        ) : (
          <div className="space-y-4">
            {contenido
              .split(/\n{2,}/)
              .map((b) => b.trim())
              .filter(Boolean)
              .map((block, i) => (
                <p
                  key={i}
                  className="whitespace-pre-line text-[15.5px] leading-[1.75] text-jjl-muted"
                >
                  {block}
                </p>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

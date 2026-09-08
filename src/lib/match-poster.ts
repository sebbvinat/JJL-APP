/**
 * Dibuja la ficha del quiz como una imagen de 1080x1920 lista para subir a
 * una story.
 *
 * Por que canvas y no una captura de pantalla: el boton "compartir" antes
 * copiaba un texto al portapapeles, y a Instagram no se sube texto. Para que
 * alguien comparta el resultado tiene que tener el archivo en la mano. Con
 * canvas controlamos el encuadre, el formato y que entre la URL abajo, que es
 * lo unico que hace que el que lo ve pueda llegar al quiz.
 *
 * Todo se dibuja a mano en vez de usar html2canvas: no suma una dependencia,
 * no depende de que el CSS se interprete igual, y la foto es del mismo origen
 * asi que no ensucia el canvas.
 */

export interface DatosPoster {
  nombre: string;
  apodo: string;
  matchPct: number;
  foto?: string;
  fortaleza: string;
  mejorGuardia: string;
  mejorPasaje: string;
}

const W = 1080;
const H = 1920;
const ROJO = '#DC2626';
const CENTRO = W / 2;

/** La familia real que resolvio next/font, para que el poster use la misma. */
function familia(): string {
  if (typeof window === 'undefined') return 'sans-serif';
  return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
}

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Achica la fuente hasta que el texto entre en `max`. */
function fuenteQueEntra(
  ctx: CanvasRenderingContext2D,
  txt: string,
  peso: number,
  ideal: number,
  max: number,
  fam: string,
): number {
  let px = ideal;
  ctx.font = `${peso} ${px}px ${fam}`;
  while (ctx.measureText(txt).width > max && px > 28) {
    px -= 4;
    ctx.font = `${peso} ${px}px ${fam}`;
  }
  return px;
}

/** Parte en lineas que entren en `max`. Devuelve como mucho `maxLineas`. */
function enLineas(ctx: CanvasRenderingContext2D, txt: string, max: number, maxLineas = 2): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of txt.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > max && actual) {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) return lineas;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

interface OpcionesTexto {
  px: number;
  fam: string;
  peso?: number;
  color?: string;
  align?: CanvasTextAlign;
  espaciado?: string;
}

function texto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: OpcionesTexto) {
  ctx.save();
  ctx.font = `${o.peso ?? 400} ${o.px}px ${o.fam}`;
  ctx.fillStyle = o.color ?? '#ffffff';
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'alphabetic';
  if (o.espaciado) ctx.letterSpacing = o.espaciado;
  ctx.fillText(t, x, y);
  ctx.restore();
}

export async function renderPoster(d: DatosPoster): Promise<Blob | null> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;

  // Si no esperamos a las fuentes, el poster sale en Times New Roman.
  try {
    await document.fonts.ready;
  } catch {
    /* navegador viejo: sigue igual */
  }
  const fam = familia();

  // Fondo ------------------------------------------------------------------
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, W, H);

  // Resplandor rojo detras del retrato: es lo que da profundidad y evita que
  // quede un rectangulo negro plano.
  const glow = ctx.createRadialGradient(CENTRO, 700, 40, CENTRO, 700, 720);
  glow.addColorStop(0, 'rgba(220,38,38,0.30)');
  glow.addColorStop(0.55, 'rgba(160,20,20,0.10)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Diagonales muy tenues, para que el fondo tenga textura de afiche.
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (let i = -H; i < W + H; i += 46) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Cabecera ---------------------------------------------------------------
  texto(ctx, 'JIU JITSU LATINO', CENTRO, 150, {
    px: 30, peso: 800, color: ROJO, espaciado: '10px', fam,
  });
  texto(ctx, 'ASÍ JUEGA TU JIU-JITSU', CENTRO, 205, {
    px: 27, peso: 600, color: 'rgba(255,255,255,0.45)', espaciado: '5px', fam,
  });

  // Retrato con el anillo de match -----------------------------------------
  const cy = 700;
  const R = 250;

  const img = d.foto ? await cargarImagen(d.foto) : null;
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTRO, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(CENTRO - R, cy - R, R * 2, R * 2);
    const lado = R * 2 * 1.16;
    ctx.drawImage(img, CENTRO - lado / 2, cy - lado / 2 + 10, lado, lado);
    ctx.restore();
  } else {
    // Sin foto, las iniciales: igual que la ficha en la app.
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTRO, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,38,38,0.14)';
    ctx.fill();
    ctx.restore();
    const iniciales = d.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    texto(ctx, iniciales, CENTRO, cy + 52, { px: 150, peso: 900, color: ROJO, fam });
  }

  // El aro apagado es el total y el rojo el porcentaje: comunica el numero
  // sin que haga falta leerlo.
  const anillo = R + 24;
  ctx.save();
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.arc(CENTRO, cy, anillo, 0, Math.PI * 2);
  ctx.stroke();

  const arco = ctx.createLinearGradient(CENTRO - anillo, cy - anillo, CENTRO + anillo, cy + anillo);
  arco.addColorStop(0, '#F97316');
  arco.addColorStop(1, ROJO);
  ctx.strokeStyle = arco;
  ctx.shadowColor = 'rgba(220,38,38,0.85)';
  ctx.shadowBlur = 34;
  ctx.beginPath();
  ctx.arc(CENTRO, cy, anillo, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * d.matchPct) / 100);
  ctx.stroke();
  ctx.restore();

  // Chapita del porcentaje, montada sobre el anillo.
  const chapaY = cy + anillo;
  ctx.save();
  ctx.fillStyle = '#050505';
  ctx.strokeStyle = ROJO;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(CENTRO - 125, chapaY - 44, 250, 88, 44);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  texto(ctx, `${d.matchPct}% MATCH`, CENTRO, chapaY + 15, {
    px: 40, peso: 900, espaciado: '1px', fam,
  });

  // Nombre -----------------------------------------------------------------
  texto(ctx, 'TE PARECÉS A', CENTRO, 1120, {
    px: 28, peso: 700, color: 'rgba(255,255,255,0.40)', espaciado: '9px', fam,
  });
  const pxNombre = fuenteQueEntra(ctx, d.nombre.toUpperCase(), 900, 108, W - 130, fam);
  texto(ctx, d.nombre.toUpperCase(), CENTRO, 1225, {
    px: pxNombre, peso: 900, espaciado: '-2px', fam,
  });
  texto(ctx, d.apodo, CENTRO, 1288, { px: 40, peso: 600, color: ROJO, fam });

  // Los tres datos ---------------------------------------------------------
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, 1370);
  ctx.lineTo(W - 110, 1370);
  ctx.stroke();
  ctx.restore();

  const filas: [string, string][] = [
    ['FORTALEZA', d.fortaleza],
    ['MEJOR GUARDIA', d.mejorGuardia],
    ['MEJOR PASAJE', d.mejorPasaje],
  ];
  let y = 1450;
  for (const [rotulo, valor] of filas) {
    texto(ctx, rotulo, 110, y, {
      px: 25, peso: 800, color: ROJO, align: 'left', espaciado: '5px', fam,
    });
    ctx.font = `600 40px ${fam}`;
    const lineas = enLineas(ctx, valor, W - 220, 2);
    lineas.forEach((linea, i) => {
      texto(ctx, linea, 110, y + 52 + i * 48, { px: 40, peso: 600, align: 'left', fam });
    });
    y += 52 + lineas.length * 48 + 34;
  }

  // Pie: sin la URL el poster no sirve para nada ---------------------------
  ctx.save();
  ctx.fillStyle = 'rgba(220,38,38,0.10)';
  ctx.fillRect(0, H - 130, W, 130);
  ctx.strokeStyle = 'rgba(220,38,38,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - 130);
  ctx.lineTo(W, H - 130);
  ctx.stroke();
  ctx.restore();
  texto(ctx, 'HACÉ EL TEST', CENTRO, H - 78, {
    px: 24, peso: 800, color: 'rgba(255,255,255,0.45)', espaciado: '7px', fam,
  });
  texto(ctx, 'alumno.jiujitsulatino.com/que-luchador-sos', CENTRO, H - 36, {
    px: 32, peso: 700, fam,
  });

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

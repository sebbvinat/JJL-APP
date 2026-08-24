#!/usr/bin/env python3
"""
Recorta una foto a un avatar circular para el quiz "¿A qué luchador te parecés?".

    python scripts/avatar-arquetipo.py <foto.jpg> <id> [--x 0.5] [--y 0.35] [--zoom 1.0]

<id> = marcelo | gordon | buchecha | bernardo | cobrinha
--x/--y  = donde esta la CARA en la foto, en proporcion (0.5 = centro).
--zoom   = 1.0 encuadre normal, 1.5 mas cerca.

Sale en public/arquetipos/<id>.png (400x400, fondo transparente).
"""
import sys, argparse
from pathlib import Path
from PIL import Image, ImageDraw

S = 400
ap = argparse.ArgumentParser()
ap.add_argument("foto"); ap.add_argument("id")
ap.add_argument("--x", type=float, default=0.5)
ap.add_argument("--y", type=float, default=0.35)
ap.add_argument("--zoom", type=float, default=1.0)
a = ap.parse_args()

im = Image.open(a.foto).convert("RGB")
w, h = im.size
lado = int(min(w, h) / a.zoom)
cx, cy = int(w * a.x), int(h * a.y)
x0 = max(0, min(w - lado, cx - lado // 2))
y0 = max(0, min(h - lado, cy - lado // 2))
im = im.crop((x0, y0, x0 + lado, y0 + lado)).resize((S, S), Image.LANCZOS)

mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse((0, 0, S - 1, S - 1), fill=255)
out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
out.paste(im, (0, 0), mask)

dest = Path(__file__).resolve().parent.parent / "public" / "arquetipos" / (a.id + ".png")
dest.parent.mkdir(parents=True, exist_ok=True)
out.save(dest, "PNG")
print("listo:", dest)

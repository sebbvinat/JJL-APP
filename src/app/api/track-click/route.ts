import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { ipDe, permitirRuta } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Los slugs reales son palabras cortas ("consultoria", "auditoria") y `source`
// sale de ?src= / utm_source. Sin tope ni chequeo de tipo, cualquiera podía
// insertar textos enormes (o un objeto) en link_clicks desde afuera.
const MAX_LARGO_SLUG = 80
const MAX_LARGO_SOURCE = 120
// Letras, números, guion, guion bajo y punto. Sin barras invertidas (regla 3).
const RE_SLUG = /^[A-Za-z0-9._-]+$/

function hashIp(ip: string | null): string | null {
  if (!ip) return null
  return createHash("sha256").update(ip).digest("hex").slice(0, 12)
}

export async function POST(req: NextRequest) {
  if (!url || !serviceRole) return NextResponse.json({ ok: false })

  // Tracking best-effort que llega por sendBeacon: si se pasa del límite
  // contestamos 200 (no 429) para que nada reintente. Falla abierto
  // (src/lib/rate-limit.ts).
  if (!(await permitirRuta(req, "track-click"))) {
    return NextResponse.json({ ok: false })
  }

  let body: { slug?: unknown; source?: unknown } | null = null
  try {
    body = await req.json()
  } catch {}

  const slug = typeof body?.slug === "string" ? body.slug.trim() : ""
  if (!slug || slug.length > MAX_LARGO_SLUG || !RE_SLUG.test(slug)) {
    return NextResponse.json({ ok: false })
  }
  const source =
    typeof body?.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, MAX_LARGO_SOURCE)
      : null

  const supa = createClient(url, serviceRole, { auth: { persistSession: false } })
  // Recortados: son cabeceras que escribe el que llama, no hay por qué guardar
  // un user-agent de 50 KB.
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null
  const ref = req.headers.get("referer")?.slice(0, 500) ?? null

  await supa.from("link_clicks").insert({
    slug,
    user_agent: ua,
    referer: ref,
    ip_hash: hashIp(ipDe(req)),
    source,
  })

  return NextResponse.json({ ok: true })
}

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"

export const dynamic = "force-dynamic"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

function hashIp(ip: string | null): string | null {
  if (!ip) return null
  return createHash("sha256").update(ip).digest("hex").slice(0, 12)
}

export async function POST(req: NextRequest) {
  if (!url || !serviceRole) return NextResponse.json({ ok: false })
  let body: { slug?: string; source?: string } = {}
  try {
    body = await req.json()
  } catch {}
  if (!body.slug) return NextResponse.json({ ok: false })

  const supa = createClient(url, serviceRole, { auth: { persistSession: false } })
  const ua = req.headers.get("user-agent") ?? null
  const ref = req.headers.get("referer") ?? null
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null

  await supa.from("link_clicks").insert({
    slug: body.slug,
    user_agent: ua,
    referer: ref,
    ip_hash: hashIp(ip),
    source: body.source ?? null,
  })

  return NextResponse.json({ ok: true })
}

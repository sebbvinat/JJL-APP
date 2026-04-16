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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  if (!url || !serviceRole) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 })
  }

  const supa = createClient(url, serviceRole, { auth: { persistSession: false } })

  const { data: link } = await supa
    .from("tracked_links")
    .select("destination_url")
    .eq("slug", slug)
    .maybeSingle<{ destination_url: string }>()

  if (!link?.destination_url) {
    return new NextResponse("Link no encontrado", { status: 404 })
  }

  const ua = req.headers.get("user-agent") ?? null
  const ref = req.headers.get("referer") ?? null
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  const source = req.nextUrl.searchParams.get("src") ?? null

  supa
    .from("link_clicks")
    .insert({
      slug,
      user_agent: ua,
      referer: ref,
      ip_hash: hashIp(ip),
      source,
    })
    .then(() => {})

  return NextResponse.redirect(link.destination_url, 302)
}

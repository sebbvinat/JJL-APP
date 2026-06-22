"use client"
import { useEffect } from "react"
import { trackViewContent } from "@/lib/meta-pixel"

export default function TrackConsultoriaView() {
  useEffect(() => {
    const source =
      new URLSearchParams(window.location.search).get("src") ?? undefined
    const body = JSON.stringify({ slug: "consultoria", source })
    try {
      const blob = new Blob([body], { type: "application/json" })
      if (navigator.sendBeacon?.("/api/track-click", blob)) return
    } catch {}
    fetch("/api/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  }, [])

  // Meta Pixel: ViewContent del programa de $900 — sirve para retargeting
  // de "casi-leads" (vieron la landing pero no completaron el quiz).
  useEffect(() => {
    trackViewContent({
      content_name: 'Programa JJL Completo',
      content_category: 'curso',
      value: 900,
      currency: 'USD',
    })
  }, [])

  return null
}

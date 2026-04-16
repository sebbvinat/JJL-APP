"use client"
import { useEffect } from "react"

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
  return null
}

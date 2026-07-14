import { NextRequest, NextResponse } from "next/server"

import { runShgmMevzuatSync } from "@/lib/shgm/sync"

export const runtime = "nodejs"
export const maxDuration = 300

/** Vercel Cron — CRON_SECRET tanımlıysa Vercel isteğe otomatik `Authorization: Bearer <secret>` ekler. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const summary = await runShgmMevzuatSync()
    return NextResponse.json(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[cron/shgm-mevzuat] sync failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

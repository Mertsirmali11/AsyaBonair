import { NextResponse } from "next/server"

import { assertCanManageShgmMevzuat } from "@/lib/shgm/access"
import { runShgmMevzuatSync } from "@/lib/shgm/sync"

export const runtime = "nodejs"
export const maxDuration = 300

/** UI'daki "Şimdi Tara" butonu — manuel tetikleme. */
export async function POST() {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) return gate.response

  try {
    const summary = await runShgmMevzuatSync()
    return NextResponse.json(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[api/shgm-mevzuat/sync] failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

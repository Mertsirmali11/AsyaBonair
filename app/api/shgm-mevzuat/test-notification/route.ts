import { NextResponse } from "next/server"

import { assertCanManageShgmMevzuat } from "@/lib/shgm/access"
import { sendShgmTestNotification } from "@/lib/shgm/notify"

export const runtime = "nodejs"

/**
 * "Test Bildirim E-postası Gönder" aksiyonu — gerçek scanner/notification akışından
 * tamamen bağımsız: hiçbir ShgmRegulation/ShgmRegulationRevision kaydını değiştirmez
 * (emailSentAt, status, revision kind dahil). Yalnızca SHGM Mevzuat yönetim izni olan
 * kullanıcılar tetikleyebilir (assertCanManageShgmMevzuat — diğer shgm-mevzuat
 * route'larıyla aynı kapı).
 */
export async function POST() {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) return gate.response

  try {
    const result = await sendShgmTestNotification()
    if ("skipped" in result) {
      return NextResponse.json({ error: `E-posta gönderilemedi: ${result.reason}` }, { status: 503 })
    }
    if (!result.sent) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[api/shgm-mevzuat/test-notification] failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

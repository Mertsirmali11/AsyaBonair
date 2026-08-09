import { NextRequest, NextResponse } from "next/server"

import { assertCanViewSaca } from "@/lib/saca-access"
import { fetchSacaAuditRows } from "@/lib/saca-audits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SACA denetim + bulgu verisi — tamamen Denetim Planı'ndan (AuditPlanEntry
 * kategori=SACA + bağlı AuditSession bulguları) türetilir. Salt okunur:
 * kayıt eklemek/düzenlemek için Denetim Planı kullanılır.
 */
export async function GET(req: NextRequest) {
  const gate = await assertCanViewSaca()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const rows = await fetchSacaAuditRows({
    from: sp.get("from"),
    to: sp.get("to"),
    aircraft: sp.get("aircraft"),
  })

  return NextResponse.json(rows)
}

import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

/** GET: bu denetime ait olay geçmişi (Reopen, durum değişiklikleri) — "Geçmiş" panelinde gösterilir. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const rows = await prisma.auditPlanEntryHistory.findMany({
    where: { auditPlanEntryId: entryId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      eventType: r.eventType,
      statusFrom: r.statusFrom,
      statusTo: r.statusTo,
      note: r.note,
      actorName: calisanName(r.actor),
    }))
  )
}

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveFindingAuditeeAccess } from "@/lib/audit-finding-auditee-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

/** GET: bulguya ait olay geçmişi (Reminder gönderimi vb.) — Finding History panelinde gösterilir. */
export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(id, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.auditFindingHistory.findMany({
    where: { auditFindingId: id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      eventType: r.eventType,
      note: r.note,
      actorName: calisanName(r.actor),
    }))
  )
}

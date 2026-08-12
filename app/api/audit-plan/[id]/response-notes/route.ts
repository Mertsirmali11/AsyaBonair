import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

/**
 * GET: bu denetime (herhangi bir response link üzerinden veya kendi hesabıyla) gönderilmiş
 * TÜM auditee notları — Manage Audit → "Auditee Notes" panelinde salt okunur gösterilir.
 * Bağlı olduğu link daha sonra iptal edilse/silinse bile bu notlar kalıcı olarak listelenir.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const notes = await prisma.auditResponseNote.findMany({
    where: { auditPlanEntryId: entryId },
    orderBy: { submittedAt: "desc" },
    include: { submittedBy: { select: { isim: true, soyisim: true } } },
  })

  return NextResponse.json(
    notes.map((n) => ({
      id: n.id,
      note: n.note,
      submitterName: n.submitterName ?? calisanName(n.submittedBy),
      submitterEmail: n.submitterEmail,
      submittedAt: n.submittedAt.toISOString(),
      viaLink: n.responseLinkId !== null,
    }))
  )
}

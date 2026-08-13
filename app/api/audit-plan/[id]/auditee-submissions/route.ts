import { NextResponse } from "next/server"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { auth } from "@/auth"
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
 * GET: Public Audit Response Link üzerinden bu denetime bağlı checklist sorularına
 * gönderilmiş TÜM auditee submission'ları (Pending/Accepted/Rejected, en yeni önce).
 * "Auditee Responses" / "Pending Auditee Responses" panelinde gösterilir.
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

  const rows = await prisma.auditeeChecklistSubmission.findMany({
    where: { sessionItem: { session: { auditPlanEntryId: entryId } } },
    orderBy: { submittedAt: "desc" },
    include: {
      sessionItem: { select: { id: true, checklistItem: { select: { label: true } } } },
      reviewedBy: { select: { isim: true, soyisim: true } },
      files: { select: { id: true, fileName: true, fileSizeBytes: true } },
    },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      sessionItemId: r.sessionItem.id,
      question: r.sessionItem.checklistItem.label,
      auditeeResponse: r.auditeeResponse,
      auditeeNote: r.auditeeNote,
      reviewStatus: r.reviewStatus,
      reviewNote: r.reviewNote,
      reviewedByName: calisanName(r.reviewedBy),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      submitterName: r.submitterName,
      submittedAt: r.submittedAt.toISOString(),
      files: r.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSizeBytes: f.fileSizeBytes })),
    }))
  )
}

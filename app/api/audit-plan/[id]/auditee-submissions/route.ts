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
 * gönderilmiş TÜM auditee submission'ları (Pending/RevisionRequested/Resubmitted/Accepted,
 * en yeni önce). "Auditee Responses" panelinde gösterilir.
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
      sessionItem: {
        select: {
          id: true,
          auditChecklistItemId: true,
          checklistItem: { select: { label: true, reference: true, sortOrder: true } },
        },
      },
      reviewedBy: { select: { isim: true, soyisim: true } },
      files: { select: { id: true, fileName: true, fileSizeBytes: true } },
    },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      sessionItemId: r.sessionItem.id,
      checklistItemId: r.sessionItem.auditChecklistItemId,
      question: r.sessionItem.checklistItem.label,
      reference: r.sessionItem.checklistItem.reference,
      sortOrder: r.sessionItem.checklistItem.sortOrder,
      // S | U | NA | OBS | null — auditee'nin seçtiği cevap (serbest metin DEĞİL)
      result: r.auditeeResponse,
      auditeeNote: r.auditeeNote,
      reviewStatus: r.reviewStatus,
      reviewNote: r.reviewNote,
      reviewedByName: calisanName(r.reviewedBy),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      submitterName: r.submitterName,
      submitterEmail: r.submitterEmail,
      submittedAt: r.submittedAt.toISOString(),
      files: r.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSizeBytes: f.fileSizeBytes })),
    }))
  )
}

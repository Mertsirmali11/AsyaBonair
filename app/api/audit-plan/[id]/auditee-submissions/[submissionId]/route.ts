import { NextResponse } from "next/server"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; submissionId: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

/**
 * PATCH: Denetçi bir auditee checklist submission'ını Accept veya Reject eder. Bu uç nokta
 * resmi AuditSessionItem kaydını DEĞİŞTİRMEZ — yalnızca submission'ın review durumunu günceller
 * (Accept edilen cevap "approved auditee response" olarak saklanır, ayrıca görüntülenir).
 * Audit History'e AUDITOR_ACCEPTED_RESPONSE / AUDITOR_REJECTED_RESPONSE olayı yazılır.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id, submissionId: submissionIdRaw } = await ctx.params
  const entryId = Number(id)
  const submissionId = Number(submissionIdRaw)
  if (!Number.isInteger(entryId) || entryId < 1 || !Number.isInteger(submissionId) || submissionId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as { action?: string; reviewNote?: string } | null
  const action = body?.action
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'accept' or 'reject'" }, { status: 400 })
  }
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : ""
  if (action === "reject" && !reviewNote) {
    return NextResponse.json({ error: "Reddetme gerekçesi zorunludur." }, { status: 400 })
  }

  const submission = await prisma.auditeeChecklistSubmission.findFirst({
    where: { id: submissionId, sessionItem: { session: { auditPlanEntryId: entryId } } },
    include: { sessionItem: { select: { checklistItem: { select: { label: true } } } } },
  })
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const actor = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })

  const updated = await prisma.auditeeChecklistSubmission.update({
    where: { id: submissionId },
    data: {
      reviewStatus: action === "accept" ? "Accepted" : "Rejected",
      reviewedById: actor?.id ?? null,
      reviewedAt: new Date(),
      reviewNote: action === "reject" ? reviewNote : null,
    },
  })

  try {
    const actorName = calisanName(actor)
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: entryId,
        actorId: actor?.id ?? null,
        eventType: action === "accept" ? "AUDITOR_ACCEPTED_RESPONSE" : "AUDITOR_REJECTED_RESPONSE",
        note:
          action === "accept"
            ? `Auditee response to "${submission.sessionItem.checklistItem.label}" accepted by ${actorName}.`
            : `Auditee response to "${submission.sessionItem.checklistItem.label}" rejected by ${actorName}: ${reviewNote}`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile review işlemi geçerli kalır
  }

  return NextResponse.json({
    id: updated.id,
    reviewStatus: updated.reviewStatus,
    reviewNote: updated.reviewNote,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
  })
}

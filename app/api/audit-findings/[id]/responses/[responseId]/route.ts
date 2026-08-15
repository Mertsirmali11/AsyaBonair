import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireCpaReviewer } from "@/lib/audit-finding-cpa-access"
import { notifyResponsibleCpaAccepted, notifyResponsibleCpaRevisionRequested } from "@/lib/audit-finding-cpa-notify"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string; responseId: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

/**
 * PATCH: CPA REVIEW aksiyonu — accept | revision_request. Bu route artık CPA İÇERİĞİNİ
 * (rootCause/correctiveAction/preventiveAction) DEĞİŞTİRMEZ — içerik yalnızca
 * POST /api/audit-findings/[id]/responses ile (sorumlu kişi tarafından, yeni bir satır olarak)
 * gönderilir/resubmit edilir. Yalnızca canAccessAuditPlan() yetkisine sahip kullanıcılar
 * (requireCpaReviewer) çağırabilir; bulgunun sorumlu tarafı (kişi VEYA — gruba atanmışsa
 * grubun HERHANGİ BİR aktif üyesi, yalnızca bu cevabı gönderen kişi değil) kendi/grubunun
 * CPA'sını inceleyemez — "self_review" ile reddedilir.
 *
 * İdempotency: atomik updateMany guard (yalnızca cpaStatus Pending/Resubmitted iken flip
 * eder) — çift tık/retry'da tekrar review-note yazılmaz, finding tekrar Closed edilmez.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id, responseId } = await ctx.params
  const findingId = Number(id)
  const respId = Number(responseId)
  if (!Number.isInteger(findingId) || findingId < 1 || !Number.isInteger(respId) || respId < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const response = await prisma.auditFindingResponse.findFirst({
    where: { id: respId, auditFindingId: findingId },
    select: { id: true },
  })
  if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const authSession = await auth()
  const reviewer = await requireCpaReviewer(findingId, authSession?.user?.email)
  if (!reviewer.ok) {
    const message =
      reviewer.reason === "self_review"
        ? "Kendi CPA cevabınızı (veya grubunuzun cevabını) inceleyemezsiniz."
        : "Yalnızca denetçi/compliance yetkisi olan kullanıcılar CPA'yı inceleyebilir."
    return NextResponse.json({ error: message }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const b = body as Record<string, unknown>
  const action = typeof b.action === "string" ? b.action : undefined
  if (action !== "accept" && action !== "revision_request") {
    return NextResponse.json({ error: "action must be 'accept' or 'revision_request'" }, { status: 400 })
  }
  const reviewNote = typeof b.reviewNote === "string" ? b.reviewNote.trim() : ""
  if (action === "revision_request" && !reviewNote) {
    return NextResponse.json({ error: "Revizyon açıklaması zorunludur." }, { status: 400 })
  }

  const actor = authSession?.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: authSession.user.email, mode: "insensitive" } },
        select: { id: true, isim: true, soyisim: true },
      })
    : null
  const actorName = calisanName(actor)

  const newStatus = action === "accept" ? "Accepted" : "RevisionRequested"

  // Atomik idempotency guard — yalnızca hâlâ Pending/Resubmitted (inceleme bekleyen) iken flip eder.
  const flip = await prisma.auditFindingResponse.updateMany({
    where: { id: respId, cpaStatus: { in: ["Pending", "Resubmitted"] } },
    data: {
      cpaStatus: newStatus,
      reviewedById: actor?.id ?? null,
      reviewedAt: new Date(),
      rejectComment: action === "revision_request" ? reviewNote : null,
    },
  })

  if (flip.count === 1) {
    if (action === "accept") {
      // Mevcut davranış korunuyor: CPA Accepted → Finding otomatik Closed.
      await prisma.auditFinding.update({ where: { id: findingId }, data: { status: "Closed" } })
    }

    try {
      await prisma.auditFindingHistory.create({
        data: {
          auditFindingId: findingId,
          actorId: actor?.id ?? null,
          eventType: action === "accept" ? "CPA_ACCEPTED" : "CPA_REVISION_REQUESTED",
          note:
            action === "accept"
              ? `CPA accepted by ${actorName}.`
              : `CPA revision requested by ${actorName}: ${reviewNote}`,
        },
      })
    } catch {
      // Geçmiş kaydı başarısız olsa bile review işlemi geçerli kalır
    }

    void (action === "accept"
      ? notifyResponsibleCpaAccepted(findingId)
      : notifyResponsibleCpaRevisionRequested(findingId, reviewNote)
    ).catch((e) => console.error("cpa-review-notify", e))
  }

  const updated = await prisma.auditFindingResponse.findUnique({
    where: { id: respId },
    include: {
      respondedBy: { select: { id: true, isim: true, soyisim: true } },
      reviewedBy: { select: { id: true, isim: true, soyisim: true } },
      attachments: true,
    },
  })
  return NextResponse.json(updated)
}

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveFindingAuditeeAccess } from "@/lib/audit-finding-auditee-access"
import { requireCpaResponsiblePerson } from "@/lib/audit-finding-cpa-access"
import { notifyAuditorsCpaSubmitted } from "@/lib/audit-finding-cpa-notify"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

/** GET: read-only, bulgu görüntüleme yetkisi olan herkes (mevcut auditee-access mantığı,
 * bu görev kapsamında DEĞİŞMİYOR — yalnızca CPA YAZMA aksiyonları sıkılaştırılıyor). */
export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const authSession = await auth()
  const access = await resolveFindingAuditeeAccess(id, authSession?.user?.email, authSession?.user?.departman)
  if (!access.isAdmin && !access.isAuditee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const responses = await prisma.auditFindingResponse.findMany({
    where: { auditFindingId: id },
    orderBy: { submittedAt: "asc" },
    include: {
      respondedBy: { select: { id: true, isim: true, soyisim: true } },
      reviewedBy: { select: { id: true, isim: true, soyisim: true } },
      attachments: true,
    },
  })

  return NextResponse.json(responses)
}

/**
 * POST: CPA cevabı oluşturur — YALNIZCA AuditFinding.assignedToId ile eşleşen kişi
 * (requireCpaResponsiblePerson). Admin olmak, auditee department/individual eşleşmesi TEK
 * BAŞINA yeterli DEĞİLDİR (bu, düzeltilen gevşekliğin ta kendisiydi). respondedById istemciden
 * ASLA alınmaz — her zaman gerçek oturum sahibinin kendi kaydına zorlanır.
 *
 * Status: bu finding için en son gönderim "RevisionRequested" ise yeni satır "Resubmitted",
 * aksi halde "Pending" olarak oluşturulur. Önceki satır DEĞİŞTİRİLMEZ (append-only) — geçmiş
 * kaybolmaz, AuditeeChecklistSubmission ile aynı desen.
 */
export async function POST(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const authSession = await auth()
  const check = await requireCpaResponsiblePerson(id, authSession?.user?.email)
  if (!check.ok) {
    return NextResponse.json({ error: "Yalnızca bu bulgunun sorumlu kişisi CPA cevabı verebilir." }, { status: 403 })
  }

  const finding = await prisma.auditFinding.findUnique({ where: { id } })
  if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const rootCause = typeof b.rootCause === "string" ? b.rootCause.trim() : null
  const correctiveAction = typeof b.correctiveAction === "string" ? b.correctiveAction.trim() : null
  const preventiveAction = typeof b.preventiveAction === "string" ? b.preventiveAction.trim() : null

  if (!rootCause && !correctiveAction && !preventiveAction)
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 })

  const latest = await prisma.auditFindingResponse.findFirst({
    where: { auditFindingId: id },
    orderBy: { submittedAt: "desc" },
    select: { cpaStatus: true },
  })
  const isResubmit = latest?.cpaStatus === "RevisionRequested"
  const cpaStatus = isResubmit ? "Resubmitted" : "Pending"

  try {
    const created = await prisma.auditFindingResponse.create({
      data: {
        auditFindingId: id,
        rootCause,
        correctiveAction,
        preventiveAction,
        respondedById: check.calisanId,
        cpaStatus,
      },
      include: {
        respondedBy: { select: { id: true, isim: true, soyisim: true } },
        reviewedBy: { select: { id: true, isim: true, soyisim: true } },
        attachments: true,
      },
    })

    try {
      const actorName = calisanName(created.respondedBy)
      await prisma.auditFindingHistory.create({
        data: {
          auditFindingId: id,
          actorId: check.calisanId,
          eventType: isResubmit ? "CPA_RESPONSE_RESUBMITTED" : "CPA_RESPONSE_SUBMITTED",
          note: isResubmit
            ? `CPA response resubmitted by ${actorName}.`
            : `CPA response submitted by ${actorName}.`,
        },
      })
    } catch {
      // Geçmiş kaydı başarısız olsa bile cevap kaydı geçerli kalır
    }

    // E-posta bildirimi auditor'lara — gönderim başarısız olsa bile CPA kaydı geçerli kalır.
    void notifyAuditorsCpaSubmitted(id, isResubmit).catch((e) => {
      console.error("notifyAuditorsCpaSubmitted", e)
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error("auditFindingResponse.create", e)
    return NextResponse.json(
      { error: "Cevap kaydedilemedi. Lütfen tekrar deneyin veya yöneticiye bildirin." },
      { status: 500 }
    )
  }
}

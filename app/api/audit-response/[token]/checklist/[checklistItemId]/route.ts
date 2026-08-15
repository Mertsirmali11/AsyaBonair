import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { ensureActiveAuditSessionItem } from "@/lib/audit-session-item-answer"
import { isResultKey } from "@/lib/audit-checklist-result"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string; checklistItemId: string }> }

const MAX_TEXT_LENGTH = 5000

/**
 * Public Audit Response Link — denetlenen tarafın bir checklist sorusuna S/U/NA/OBS cevabı,
 * not ve/veya dosya göndermesi. Bu KESİNLİKLE resmi AuditSessionItem.result/notes alanlarını
 * YAZMAZ — ayrı bir AuditeeChecklistSubmission satırı olarak, "Pending" (veya önceki gönderim
 * "RevisionRequested" ise "Resubmitted") review durumuyla eklenir. Yalnızca yetkili bir Bonjour
 * kullanıcısı (Manage Audit → Auditee Responses) bunu inceleyip Accept/Revision Request edebilir.
 *
 * Route parametresi kasıtlı olarak `checklistItemId` (AuditChecklistItem.id) — `sessionItemId`
 * DEĞİL: checklist atandığı sürece bu id her zaman mevcuttur, auditor henüz o soruyu hiç
 * açmamış olsa bile. AuditSession/AuditSessionItem yoksa burada idempotent olarak oluşturulur
 * (ensureActiveAuditSessionItem) — audit-session-client.tsx'teki ensureSessionItemId ile aynı
 * prensip, ayrı bir paralel sistem değil.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { token, checklistItemId: checklistItemIdRaw } = await ctx.params
  const checklistItemId = Number(checklistItemIdRaw)
  if (!Number.isInteger(checklistItemId) || checklistItemId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json({ error: responseLinkReasonMessage(validation.reason) }, { status: 404 })
  }

  // Bu checklist maddesi gerçekten bu denetime ATANMIŞ bir checklist'e mi ait — kritik
  // güvenlik kontrolü, aksi halde token sahibi id tahmin ederek başka denetimlerin (veya hiç
  // atanmamış bir checklist'in) sorusuna cevap gönderebilir.
  const clItem = await prisma.auditChecklistItem.findFirst({
    where: {
      id: checklistItemId,
      checklist: { assignments: { some: { auditPlanEntryId: validation.link.auditPlanEntryId } } },
    },
    select: { id: true, label: true, auditChecklistId: true },
  })
  if (!clItem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    result?: string | null
    auditeeNote?: string
    submitterName?: string
    submitterEmail?: string
    files?: { path: string; fileName: string; mimeType?: string; sizeBytes?: number }[]
  } | null

  const result = typeof body?.result === "string" ? body.result : null
  if (result !== null && !isResultKey(result)) {
    return NextResponse.json({ error: "Geçersiz cevap. S, U, NA veya OBS seçin." }, { status: 400 })
  }
  const auditeeNote = typeof body?.auditeeNote === "string" ? body.auditeeNote.trim() : ""
  const rawFiles = Array.isArray(body?.files) ? body!.files : []
  const files = rawFiles.filter(
    (f): f is { path: string; fileName: string; mimeType?: string; sizeBytes?: number } =>
      !!f && typeof f.path === "string" && typeof f.fileName === "string"
  )

  if (!result && !auditeeNote && files.length === 0) {
    return NextResponse.json({ error: "Cevap, not veya dosyalardan en az biri girilmelidir." }, { status: 400 })
  }
  if (auditeeNote.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: `En fazla ${MAX_TEXT_LENGTH} karakter olabilir.` }, { status: 400 })
  }

  const submitterName = typeof body?.submitterName === "string" ? body.submitterName.trim() : ""
  if (!submitterName) {
    return NextResponse.json({ error: "İsim zorunludur." }, { status: 400 })
  }
  const submitterEmail = typeof body?.submitterEmail === "string" ? body.submitterEmail.trim() : ""

  const { sessionItemId } = await ensureActiveAuditSessionItem(
    validation.link.auditPlanEntryId,
    clItem.auditChecklistId,
    checklistItemId
  )

  // Pending → RevisionRequested → Resubmitted → Accepted. Bu sorunun bu link üzerinden en son
  // gönderimi "RevisionRequested" ise, yeni gönderim "Resubmitted" olarak işaretlenir — eski
  // satır DEĞİŞTİRİLMEZ (append-only), yalnızca yeni bir satır eklenir.
  const previousLatest = await prisma.auditeeChecklistSubmission.findFirst({
    where: { auditSessionItemId: sessionItemId },
    orderBy: { submittedAt: "desc" },
    select: { reviewStatus: true },
  })
  const reviewStatus = previousLatest?.reviewStatus === "RevisionRequested" ? "Resubmitted" : "Pending"

  const created = await prisma.auditeeChecklistSubmission.create({
    data: {
      auditSessionItemId: sessionItemId,
      responseLinkId: validation.link.id,
      auditeeResponse: result,
      auditeeNote: auditeeNote || null,
      submitterName,
      submitterEmail: submitterEmail || null,
      reviewStatus,
      files: {
        create: files.map((f) => ({
          fileName: f.fileName,
          storagePath: f.path,
          mimeType: f.mimeType ?? null,
          fileSizeBytes: typeof f.sizeBytes === "number" ? f.sizeBytes : null,
        })),
      },
    },
    include: { files: true },
  })

  try {
    const parts: string[] = []
    if (result) parts.push(`cevap: ${result}`)
    if (auditeeNote) parts.push("not")
    if (files.length > 0) parts.push(`${files.length} dosya`)
    const submitterInfo = submitterEmail ? `${submitterName} (${submitterEmail})` : submitterName
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: validation.link.auditPlanEntryId,
        actorId: null,
        eventType: reviewStatus === "Resubmitted" ? "AUDITEE_CHECKLIST_RESPONSE_RESUBMITTED" : "AUDITEE_CHECKLIST_RESPONSE_SUBMITTED",
        note:
          reviewStatus === "Resubmitted"
            ? `Checklist question "${clItem.label}" — resubmitted (${parts.join(", ")}) via external audit link by ${submitterInfo}. Pending auditor review.`
            : `Checklist question "${clItem.label}" — ${parts.join(", ")} submitted via external audit link by ${submitterInfo}. Pending auditor review.`,
      },
    })
  } catch {
    // Geçmiş kaydı başarısız olsa bile gönderim geçerli kalır
  }

  return NextResponse.json(
    {
      ok: true,
      submission: {
        id: created.id,
        checklistItemId,
        auditeeResponse: created.auditeeResponse,
        auditeeNote: created.auditeeNote,
        reviewStatus: created.reviewStatus,
        reviewNote: created.reviewNote,
        submittedAt: created.submittedAt.toISOString(),
        files: created.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSizeBytes: f.fileSizeBytes })),
      },
    },
    { status: 201 }
  )
}

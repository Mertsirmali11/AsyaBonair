import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string; sessionItemId: string }> }

const MAX_TEXT_LENGTH = 5000

/**
 * Public Audit Response Link — denetlenen tarafın bir checklist sorusuna cevap/not/dosya
 * göndermesi. Bu KESİNLİKLE resmi AuditSessionItem.result/notes alanlarını YAZMAZ — ayrı bir
 * AuditeeChecklistSubmission satırı olarak, "Pending" review durumuyla eklenir. Yalnızca
 * yetkili bir Bonjour kullanıcısı (Manage Audit → Auditee Responses) bunu inceleyip
 * Accept/Reject edebilir. Reddedilirse denetlenen yeniden gönderebilir (append-only geçmiş).
 */
export async function POST(req: Request, ctx: Ctx) {
  const { token, sessionItemId: sessionItemIdRaw } = await ctx.params
  const sessionItemId = Number(sessionItemIdRaw)
  if (!Number.isInteger(sessionItemId) || sessionItemId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json({ error: responseLinkReasonMessage(validation.reason) }, { status: 404 })
  }

  // Bu session item gerçekten bu link'in denetimine mi ait — kritik güvenlik kontrolü.
  const sessionItem = await prisma.auditSessionItem.findFirst({
    where: { id: sessionItemId, session: { auditPlanEntryId: validation.link.auditPlanEntryId } },
    select: { id: true, checklistItem: { select: { label: true } } },
  })
  if (!sessionItem) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json().catch(() => null)) as {
    auditeeResponse?: string
    auditeeNote?: string
    submitterName?: string
    submitterEmail?: string
    files?: { path: string; fileName: string; mimeType?: string; sizeBytes?: number }[]
  } | null

  const auditeeResponse = typeof body?.auditeeResponse === "string" ? body.auditeeResponse.trim() : ""
  const auditeeNote = typeof body?.auditeeNote === "string" ? body.auditeeNote.trim() : ""
  const rawFiles = Array.isArray(body?.files) ? body!.files : []
  const files = rawFiles.filter(
    (f): f is { path: string; fileName: string; mimeType?: string; sizeBytes?: number } =>
      !!f && typeof f.path === "string" && typeof f.fileName === "string"
  )

  if (!auditeeResponse && !auditeeNote && files.length === 0) {
    return NextResponse.json({ error: "Cevap, not veya dosya en az birinin girilmesi gerekir." }, { status: 400 })
  }
  if (auditeeResponse.length > MAX_TEXT_LENGTH || auditeeNote.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: `En fazla ${MAX_TEXT_LENGTH} karakter olabilir.` }, { status: 400 })
  }

  const submitterName = typeof body?.submitterName === "string" ? body.submitterName.trim() : ""
  if (!submitterName) {
    return NextResponse.json({ error: "İsim zorunludur." }, { status: 400 })
  }
  const submitterEmail = typeof body?.submitterEmail === "string" ? body.submitterEmail.trim() : ""

  const created = await prisma.auditeeChecklistSubmission.create({
    data: {
      auditSessionItemId: sessionItemId,
      responseLinkId: validation.link.id,
      auditeeResponse: auditeeResponse || null,
      auditeeNote: auditeeNote || null,
      submitterName,
      submitterEmail: submitterEmail || null,
      reviewStatus: "Pending",
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
    if (auditeeResponse) parts.push("cevap")
    if (auditeeNote) parts.push("not")
    if (files.length > 0) parts.push(`${files.length} dosya`)
    await prisma.auditPlanEntryHistory.create({
      data: {
        auditPlanEntryId: validation.link.auditPlanEntryId,
        actorId: null,
        eventType: "AUDITEE_CHECKLIST_RESPONSE_SUBMITTED",
        note: `Checklist question "${sessionItem.checklistItem.label}" — ${parts.join(", ")} submitted via external audit link by ${submitterName}. Pending auditor review.`,
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

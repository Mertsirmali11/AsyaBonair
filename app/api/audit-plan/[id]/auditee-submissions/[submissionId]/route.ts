import { NextResponse } from "next/server"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { auth } from "@/auth"
import { upsertAuditSessionItemAnswer } from "@/lib/audit-session-item-answer"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; submissionId: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

/**
 * PATCH: Denetçi bir auditee checklist submission'ını Accept veya Revision Request eder.
 *
 * accept: auditee'nin seçtiği result + auditeeNote + dosyalar resmi AuditSessionItem'a
 * aktarılır — aynı save mantığı auditor'un PUT /api/audit-sessions/[id]/items ile paylaşılır
 * (lib/audit-session-item-answer.ts), paralel bir yazma yolu YOKTUR. Bilerek finding
 * auto-create/sync TETİKLENMEZ (auditee bir Level/Category seçmez; auditor gerekirse ayrı
 * "Add Finding" aksiyonuyla kendi sınıflandırma kararını verir).
 *
 * İdempotency: `updateMany` ile yalnızca hâlâ "Pending" veya "Resubmitted" durumundaki satır
 * atomik olarak "Accepted"a çevrilir (`count === 1` ise devam edilir). Eşzamanlı iki Accept
 * isteği (çift tık, ağ tekrar denemesi) veya aynı submission'a ikinci bir Accept çağrısı
 * result/attachment transferini TEKRAR ÇALIŞTIRMAZ — ikinci istek mevcut durumu no-op olarak
 * döner, ne AuditSessionItem tekrar yazılır ne de attachment ikinci kez kopyalanır.
 *
 * revision_request (eski adıyla "reject"): Pending | Resubmitted → RevisionRequested. Auditee
 * bir sonraki gönderiminde bu review'e YENİ bir satır ekler (append-only) — geçmiş kaybolmaz.
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
  if (action !== "accept" && action !== "revision_request") {
    return NextResponse.json({ error: "action must be 'accept' or 'revision_request'" }, { status: 400 })
  }
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : ""
  if (action === "revision_request" && !reviewNote) {
    return NextResponse.json({ error: "Revizyon açıklaması zorunludur." }, { status: 400 })
  }

  const submission = await prisma.auditeeChecklistSubmission.findFirst({
    where: { id: submissionId, sessionItem: { session: { auditPlanEntryId: entryId } } },
    include: {
      sessionItem: {
        select: {
          id: true,
          auditSessionId: true,
          auditChecklistItemId: true,
          checklistItem: { select: { label: true } },
        },
      },
      files: true,
    },
  })
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const actor = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true },
  })
  const actorName = calisanName(actor)

  if (action === "accept") {
    // Atomik idempotency guard: yalnızca HÂLÂ Pending/Resubmitted durumundaysa "Accepted"a
    // çevir. count === 0 ise (zaten Accepted, ya da eşzamanlı başka bir istek onu az önce
    // Accepted yaptı) hiçbir şey tekrar yazılmaz — mevcut durum no-op olarak döner.
    const flip = await prisma.auditeeChecklistSubmission.updateMany({
      where: { id: submissionId, reviewStatus: { in: ["Pending", "Resubmitted"] } },
      data: { reviewStatus: "Accepted", reviewedById: actor?.id ?? null, reviewedAt: new Date(), reviewNote: null },
    })

    if (flip.count === 1) {
      // Resmi AuditSessionItem'a aktar — auditor PUT'un kullandığı AYNI fonksiyon. notes
      // (auditor notu) kasıtlı olarak undefined bırakılır — mevcut auditor notuna DOKUNULMAZ.
      const answer = await upsertAuditSessionItemAnswer({
        auditSessionId: submission.sessionItem.auditSessionId,
        auditChecklistItemId: submission.sessionItem.auditChecklistItemId,
        result: submission.auditeeResponse,
        notes: undefined,
        auditeeNotes: submission.auditeeNote,
      })
      if (!answer.ok) {
        // submission zaten Accepted olarak işaretlendi ama transfer başarısız oldu — normal
        // akışta olmaması gereken bir durum (result zaten submit anında doğrulanmıştı).
        // Sessizce yutmak yerine görünür kılıyoruz; kullanıcıya yine de başarı dönülür çünkü
        // review durumu geçerli, yalnızca transfer için tekrar deneme/manuel kontrol gerekebilir.
        console.error("[auditee-submissions] accept: AuditSessionItem transferi başarısız", {
          submissionId,
          error: answer.error,
        })
      }

      // Ekleri kopyala — yalnızca flip.count === 1 olduğunda (tek seferlik) çalışır, bu yüzden
      // aynı submission iki kez Accept edilse bile duplicate attachment OLUŞMAZ.
      if (answer.ok && submission.files.length > 0) {
        await prisma.auditSessionItemAttachment.createMany({
          data: submission.files.map((f) => ({
            auditSessionItemId: answer.sessionItem.id,
            uploadedBy: "auditee",
            fileName: f.fileName,
            storagePath: f.storagePath,
            mimeType: f.mimeType,
            fileSizeBytes: f.fileSizeBytes,
          })),
        })
      }

      try {
        await prisma.auditPlanEntryHistory.create({
          data: {
            auditPlanEntryId: entryId,
            actorId: actor?.id ?? null,
            eventType: "AUDITOR_ACCEPTED_RESPONSE",
            note: `Auditee response accepted by ${actorName} — question: "${submission.sessionItem.checklistItem.label}".`,
          },
        })
      } catch {
        // Geçmiş kaydı başarısız olsa bile review işlemi geçerli kalır
      }
    }

    const updated = await prisma.auditeeChecklistSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, reviewStatus: true, reviewNote: true, reviewedAt: true },
    })
    return NextResponse.json({
      id: updated!.id,
      reviewStatus: updated!.reviewStatus,
      reviewNote: updated!.reviewNote,
      reviewedAt: updated!.reviewedAt?.toISOString() ?? null,
    })
  }

  // revision_request
  const flip = await prisma.auditeeChecklistSubmission.updateMany({
    where: { id: submissionId, reviewStatus: { in: ["Pending", "Resubmitted"] } },
    data: {
      reviewStatus: "RevisionRequested",
      reviewedById: actor?.id ?? null,
      reviewedAt: new Date(),
      reviewNote,
    },
  })

  if (flip.count === 1) {
    try {
      await prisma.auditPlanEntryHistory.create({
        data: {
          auditPlanEntryId: entryId,
          actorId: actor?.id ?? null,
          eventType: "AUDITOR_REVISION_REQUESTED",
          note: `Revision requested by ${actorName} for question "${submission.sessionItem.checklistItem.label}": ${reviewNote}`,
        },
      })
    } catch {
      // Geçmiş kaydı başarısız olsa bile review işlemi geçerli kalır
    }
  }

  const updated = await prisma.auditeeChecklistSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, reviewStatus: true, reviewNote: true, reviewedAt: true },
  })
  return NextResponse.json({
    id: updated!.id,
    reviewStatus: updated!.reviewStatus,
    reviewNote: updated!.reviewNote,
    reviewedAt: updated!.reviewedAt?.toISOString() ?? null,
  })
}

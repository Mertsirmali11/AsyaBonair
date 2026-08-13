import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string }> }

/**
 * Public Audit Response Link — token ile kimliklendirilir, OTURUM GEREKMEZ.
 * Yalnızca bu tek denetime ait, cevap ekranında gösterilecek sade bilgileri döner:
 * Audit Number / Type / açıklama / planlı tarih, ve bu link'in bağlı olduğu denetime
 * daha önce auditee tarafından gönderilmiş not/dosyalar (kendi gönderim geçmişini görsün diye).
 * Checklist, finding, auditor bilgisi, diğer audit kayıtları — HİÇBİRİ döndürülmez.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const validation = await validateActiveResponseLink(token)
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, reason: validation.reason, message: responseLinkReasonMessage(validation.reason) },
      { status: 404 }
    )
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id: validation.link.auditPlanEntryId },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
    },
  })
  if (!entry) {
    return NextResponse.json({ ok: false, reason: "not_found", message: responseLinkReasonMessage("not_found") }, { status: 404 })
  }

  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat
  const auditNumber = entry.auditNumberPrefix ? `${entry.auditNumberPrefix}-${entry.id}` : `AP-${entry.id}`

  const [notes, files, sessions] = await Promise.all([
    prisma.auditResponseNote.findMany({
      where: { auditPlanEntryId: entry.id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        note: true,
        submitterName: true,
        submittedAt: true,
        submittedBy: { select: { isim: true, soyisim: true } },
      },
    }),
    prisma.auditPlanDocument.findMany({
      where: { auditPlanEntryId: entry.id, source: "auditee" },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, fileSizeBytes: true, submitterName: true, createdAt: true },
    }),
    // Bu denetime bağlı checklist oturum(lar)ı — auditor'un cevabı/sonucu (result/notes)
    // HİÇBİR ZAMAN döndürülmez, yalnızca soru metni ve bu link'in KENDİ gönderimleri.
    prisma.auditSession.findMany({
      where: { auditPlanEntryId: entry.id, archivedAt: null },
      select: {
        id: true,
        checklist: { select: { title: true, checklistNumber: true } },
        items: {
          orderBy: { checklistItem: { sortOrder: "asc" } },
          select: {
            id: true,
            checklistItem: {
              select: { label: true, reference: true, section: true, isHeading: true, sortOrder: true },
            },
            auditeeSubmissions: {
              where: { responseLinkId: validation.link.id },
              orderBy: { submittedAt: "desc" },
              select: {
                id: true,
                auditeeResponse: true,
                auditeeNote: true,
                reviewStatus: true,
                reviewNote: true,
                submittedAt: true,
                files: { select: { id: true, fileName: true, fileSizeBytes: true } },
              },
            },
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    entry: {
      auditNumber,
      field,
      description: entry.remarks,
      plannedDate: entry.plannedDate.toISOString(),
    },
    notes: notes.map((n) => ({
      id: n.id,
      note: n.note,
      submitterName:
        n.submitterName ??
        ([n.submittedBy?.isim, n.submittedBy?.soyisim].filter(Boolean).join(" ").trim() || null),
      submittedAt: n.submittedAt.toISOString(),
    })),
    files: files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSizeBytes: f.fileSizeBytes,
      submitterName: f.submitterName,
      createdAt: f.createdAt.toISOString(),
    })),
    checklistSessions: sessions
      .filter((s) => s.items.length > 0)
      .map((s) => ({
        sessionId: s.id,
        checklistTitle: s.checklist.title,
        checklistNumber: s.checklist.checklistNumber,
        items: s.items
          .filter((it) => !it.checklistItem.isHeading)
          .map((it) => ({
            sessionItemId: it.id,
            label: it.checklistItem.label,
            reference: it.checklistItem.reference,
            section: it.checklistItem.section,
            submissions: it.auditeeSubmissions.map((sub) => ({
              id: sub.id,
              auditeeResponse: sub.auditeeResponse,
              auditeeNote: sub.auditeeNote,
              reviewStatus: sub.reviewStatus,
              reviewNote: sub.reviewNote,
              submittedAt: sub.submittedAt.toISOString(),
              files: sub.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSizeBytes: f.fileSizeBytes })),
            })),
          })),
      })),
  })
}

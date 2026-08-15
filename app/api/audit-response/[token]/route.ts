import { NextResponse } from "next/server"
import { validateActiveResponseLink, responseLinkReasonMessage } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ token: string }> }

/**
 * Public Audit Response Link — token ile kimliklendirilir, OTURUM GEREKMEZ.
 * Audit Number / Type / açıklama / planlı tarih, bu link'in bağlı olduğu denetime daha önce
 * auditee tarafından gönderilmiş genel not/dosyalar, VE bu denetime şu an atanmış checklist'lerin
 * TÜM sorularını döner. Auditor notu, finding, diğer audit kayıtları — HİÇBİRİ döndürülmez.
 *
 * ÖNEMLİ (checklist görünürlük kök-neden fix'i): Sorular `AuditPlanChecklistAssignment →
 * AuditChecklist.items` (master liste) üzerinden geliyor — `AuditSession`/`AuditSessionItem`
 * VARLIĞINA bağlı DEĞİL. Auditor "Denetim Yürüt" ekranını hiç açmamış olsa bile (henüz hiçbir
 * AuditSession/AuditSessionItem yokken) checklist tam olarak görünür. Aktif (archivedAt: null)
 * session/session-item varsa yalnızca "bu soruya daha önce ne cevap verildi" eşlemesi için
 * kullanılır — snapshot/kilit YOKTUR, checklist sonradan atanırsa veya değişirse link her
 * açılışta güncel durumu okur.
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

  const [notes, files, assignments] = await Promise.all([
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
    // Denetime ŞU AN atanmış checklist'ler — asıl soru kaynağı bu, AuditSession değil.
    prisma.auditPlanChecklistAssignment.findMany({
      where: { auditPlanEntryId: entry.id },
      orderBy: { assignedAt: "asc" },
      select: {
        id: true,
        checklist: {
          select: {
            id: true,
            title: true,
            checklistNumber: true,
            items: {
              where: { isHeading: false },
              orderBy: { sortOrder: "asc" },
              select: { id: true, label: true, reference: true, section: true, sortOrder: true },
            },
          },
        },
      },
    }),
  ])

  // Bu checklist'lerin aktif (archivedAt: null) session'ları varsa, madde bazında mevcut
  // cevap/submission eşlemesi için kullanılır — checklist removed/re-add sonrası archived
  // session'lar burada KESİNLİKLE hariç tutulur (mevcut korumayla birebir aynı).
  const checklistIds = assignments.map((a) => a.checklist.id)
  const activeSessions = checklistIds.length
    ? await prisma.auditSession.findMany({
        where: { auditPlanEntryId: entry.id, auditChecklistId: { in: checklistIds }, archivedAt: null },
        select: {
          auditChecklistId: true,
          items: {
            select: {
              id: true,
              auditChecklistItemId: true,
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
      })
    : []
  const sessionByChecklistId = new Map(activeSessions.map((s) => [s.auditChecklistId, s]))

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
    checklistSessions: assignments
      .filter((a) => a.checklist.items.length > 0)
      .map((a) => {
        const activeSession = sessionByChecklistId.get(a.checklist.id)
        const itemBySessionMap = new Map(
          (activeSession?.items ?? []).map((si) => [si.auditChecklistItemId, si])
        )
        return {
          checklistId: a.checklist.id,
          checklistTitle: a.checklist.title,
          checklistNumber: a.checklist.checklistNumber,
          items: a.checklist.items.map((it) => {
            const sessionItem = itemBySessionMap.get(it.id)
            return {
              // Public formun submit ettiği kararlı kimlik — AuditChecklistItem.id. AuditSessionItem
              // henüz yoksa dahi bu değer her zaman mevcuttur (checklist assign edildiği sürece).
              checklistItemId: it.id,
              label: it.label,
              reference: it.reference,
              section: it.section,
              submissions: (sessionItem?.auditeeSubmissions ?? []).map((sub) => ({
                id: sub.id,
                auditeeResponse: sub.auditeeResponse,
                auditeeNote: sub.auditeeNote,
                reviewStatus: sub.reviewStatus,
                reviewNote: sub.reviewNote,
                submittedAt: sub.submittedAt.toISOString(),
                files: sub.files.map((f) => ({ id: f.id, fileName: f.fileName, fileSizeBytes: f.fileSizeBytes })),
              })),
            }
          }),
        }
      }),
  })
}

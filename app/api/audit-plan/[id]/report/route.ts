import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { defaultChecklistNumber } from "@/lib/audit-checklist-helpers"
import { dbDateToDdMmYyyy } from "@/lib/correspondence-date"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null } | null): string | null {
  if (!c) return null
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || null
}

function formatAuditNumber(entry: { id: number; auditNumberPrefix: string | null }): string {
  const p = entry.auditNumberPrefix?.trim()
  return p ? `${p}-${entry.id}` : `AP-${entry.id}`
}

/**
 * GET: Initial Report / Full Report için tek bir denetim kaydına ait TÜM verileri
 * derleyip döndürür — checklist + cevaplar + notlar + dosya ekleri + finding'ler
 * (checklist üzerinden otomatik + manuel) + genel dosyalar + geçmiş. Salt okunur,
 * hiçbir veriyi değiştirmez. PDF üretimi tamamen istemci tarafında (jsPDF) yapılır.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id: entryId },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
      auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      checklistAssignments: {
        orderBy: { assignedAt: "asc" },
        include: {
          checklist: {
            select: { id: true, title: true, checklistNumber: true, latestRevisionNumber: true },
          },
        },
      },
      documents: {
        orderBy: { createdAt: "asc" },
        include: { uploader: { select: { isim: true, soyisim: true } } },
      },
      history: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { isim: true, soyisim: true } } },
      },
    },
  })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Her atanmış checklist için (varsa) oturumu, madde cevaplarını, notlarını, eklerini ve finding'ini getir
  const checklists = await Promise.all(
    entry.checklistAssignments.map(async (a) => {
      const sessionRow = await prisma.auditSession.findFirst({
        where: { auditPlanEntryId: entryId, auditChecklistId: a.checklist.id, archivedAt: null },
        include: {
          items: {
            include: {
              checklistItem: true,
              attachments: true,
              finding: { select: { id: true, findingCode: true, findingLevel: true, findingCategory: true, status: true } },
            },
          },
        },
      })

      const checklistItems = await prisma.auditChecklistItem.findMany({
        where: { auditChecklistId: a.checklist.id },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      })

      const itemsByChecklistItemId = new Map(
        (sessionRow?.items ?? []).map((si) => [si.auditChecklistItemId, si])
      )

      return {
        checklistId: a.checklist.id,
        title: a.checklist.title,
        checklistNumber: a.checklist.checklistNumber ?? defaultChecklistNumber(a.checklist.id),
        revision: a.checklist.latestRevisionNumber,
        sessionStatus: sessionRow?.status ?? null,
        auditorComment: sessionRow?.auditorComment ?? null,
        auditeeComment: sessionRow?.auditeeComment ?? null,
        items: checklistItems.map((ci) => {
          const si = itemsByChecklistItemId.get(ci.id)
          return {
            label: ci.label,
            reference: ci.reference,
            section: ci.section,
            isHeading: ci.isHeading,
            result: si?.result ?? null,
            notes: si?.notes ?? null,
            auditeeNotes: si?.auditeeNotes ?? null,
            finding: si?.finding
              ? {
                  findingCode: si.finding.findingCode,
                  findingLevel: si.finding.findingLevel,
                  findingCategory: si.finding.findingCategory,
                  status: si.finding.status,
                }
              : null,
            attachments: (si?.attachments ?? []).map((att) => ({
              fileName: att.fileName,
              uploadedBy: att.uploadedBy,
              fileSizeBytes: att.fileSizeBytes,
              uploadedAt: att.uploadedAt.toISOString(),
            })),
          }
        }),
      }
    })
  )

  // Tüm finding'ler (checklist üzerinden otomatik + manuel), en güncel CPA cevabıyla
  const findingRows = await prisma.auditFinding.findMany({
    where: { deletedAt: null, OR: [{ auditPlanEntryId: entryId }, { session: { auditPlanEntryId: entryId } }] },
    orderBy: { createdAt: "asc" },
    include: {
      assignedTo: { select: { isim: true, soyisim: true, departman: true } },
      responses: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  })

  const findings = findingRows.map((f) => ({
    findingCode: f.findingCode,
    findingLevel: f.findingLevel,
    findingCategory: f.findingCategory,
    explanation: f.explanation,
    reference: f.reference,
    field: f.field,
    status: f.status,
    initializedOn: f.initializedOn.toISOString(),
    dueDate: f.dueDate ? f.dueDate.toISOString() : null,
    isManual: f.auditSessionId === null,
    assignedTo: f.assignedTo
      ? { name: calisanName(f.assignedTo), department: f.assignedTo.departman }
      : null,
    latestResponse: f.responses[0]
      ? {
          rootCause: f.responses[0].rootCause,
          correctiveAction: f.responses[0].correctiveAction,
          preventiveAction: f.responses[0].preventiveAction,
          cpaStatus: f.responses[0].cpaStatus,
        }
      : null,
  }))

  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat

  // Basit özet / sonuç metni (mevcut verilerden türetilir)
  const totalQuestions = checklists.reduce(
    (sum, c) => sum + c.items.filter((i) => !i.isHeading).length,
    0
  )
  const unsatisfactoryCount = checklists.reduce(
    (sum, c) => sum + c.items.filter((i) => i.result === "U").length,
    0
  )
  const openFindings = findings.filter((f) => f.status === "Open").length
  const closedFindings = findings.filter((f) => f.status === "Closed").length

  return NextResponse.json({
    entry: {
      auditNumber: formatAuditNumber(entry),
      field,
      categoryName: cat,
      subCategoryName: sub ?? null,
      datePlanned: dbDateToDdMmYyyy(entry.plannedDate),
      datePostponed: entry.datePostponed ? dbDateToDdMmYyyy(entry.datePostponed) : null,
      initializedDate: entry.initializedDate ? dbDateToDdMmYyyy(entry.initializedDate) : null,
      ct: entry.ct,
      remarks: entry.remarks,
      status: entry.status,
      cancellationReason: entry.cancellationReason,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    },
    auditors: entry.auditors.map((a) => calisanName(a.calisan)).filter((n): n is string => !!n),
    auditees: entry.auditees.map((a) => calisanName(a.calisan)).filter((n): n is string => !!n),
    checklists,
    findings,
    documents: entry.documents.map((d) => ({
      fileName: d.fileName,
      uploadedByName: calisanName(d.uploader),
      fileSizeBytes: d.fileSizeBytes,
      createdAt: d.createdAt.toISOString(),
    })),
    history: entry.history.map((h) => ({
      createdAt: h.createdAt.toISOString(),
      eventType: h.eventType,
      statusFrom: h.statusFrom,
      statusTo: h.statusTo,
      note: h.note,
      actorName: calisanName(h.actor),
    })),
    summary: {
      totalQuestions,
      unsatisfactoryCount,
      totalFindings: findings.length,
      openFindings,
      closedFindings,
    },
  })
}

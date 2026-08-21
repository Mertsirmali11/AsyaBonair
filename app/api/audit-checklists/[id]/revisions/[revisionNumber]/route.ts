import { NextResponse } from "next/server"
import {
  defaultChecklistNumber,
  formatYmdUtc,
  serializeAuditChecklistItemRow,
} from "@/lib/audit-checklist-helpers"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string; revisionNumber: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  const revNo = Number((await ctx.params).revisionNumber)
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(revNo)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const checklist = await prisma.auditChecklist.findUnique({ where: { id } })
  if (!checklist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const checklistMeta = {
    id: checklist.id,
    title: checklist.title,
    checklistNumber: checklist.checklistNumber ?? defaultChecklistNumber(checklist.id),
    latestRevisionNumber: checklist.latestRevisionNumber,
    isActive: checklist.isActive,
  }

  const stored = await prisma.auditChecklistRevision.findUnique({
    where: {
      auditChecklistId_revisionNumber: {
        auditChecklistId: id,
        revisionNumber: revNo,
      },
    },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  })

  // Görüntülenen numara "en güncel" revizyonsa (== canEdit alanı) — bu ekran DÜZENLENEBİLİR ve
  // "Kaydet" doğrudan CANLI `AuditChecklistItem` tablosuna yazar. `id` alanı bu yüzden HER ZAMAN
  // canlı tablonun id'si olmalı: `AuditChecklistRevisionItem` (arşiv anlık görüntüsü) tamamen
  // ayrı bir id uzayı kullanıyor ve editördeki "existingId" eşlemesi bu ikisini karıştırırsa
  // düzenleme yanlış (alakasız) bir canlı satırı hedef alabilir. Arşiv metadata'sı (id/tarih)
  // varsa gösterim için stored'dan alınır, ama madde listesi her zaman canlı tablodan gelir.
  if (revNo === checklist.latestRevisionNumber) {
    const full = await prisma.auditChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    })
    if (!full) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({
      checklist: checklistMeta,
      revision: {
        id: stored?.id ?? null,
        revisionNumber: revNo,
        revisionDate: stored
          ? formatYmdUtc(stored.revisionDate)
          : formatYmdUtc(full.latestRevisionDate),
        title: stored?.title ?? full.title,
        description: stored ? stored.description : full.description,
        items: full.items.map(serializeAuditChecklistItemRow),
        synthetic: !stored,
        missingSnapshot: false,
      },
    })
  }

  if (stored) {
    return NextResponse.json({
      checklist: checklistMeta,
      revision: {
        id: stored.id,
        revisionNumber: stored.revisionNumber,
        revisionDate: formatYmdUtc(stored.revisionDate),
        title: stored.title,
        description: stored.description,
        items: stored.items.map(serializeAuditChecklistItemRow),
        synthetic: false,
        missingSnapshot: false,
      },
    })
  }

  if (
    revNo >= checklist.initialRevisionNumber &&
    revNo < checklist.latestRevisionNumber
  ) {
    return NextResponse.json({
      checklist: checklistMeta,
      revision: {
        id: null,
        revisionNumber: revNo,
        revisionDate:
          revNo === checklist.initialRevisionNumber
            ? formatYmdUtc(checklist.initialRevisionDate)
            : "—",
        title: checklist.title,
        description: checklist.description,
        items: [],
        synthetic: true,
        missingSnapshot: true,
      },
    })
  }

  return NextResponse.json({ error: "Revision not found" }, { status: 404 })
}

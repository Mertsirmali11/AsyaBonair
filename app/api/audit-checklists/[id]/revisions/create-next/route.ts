import { NextResponse } from "next/server"
import { defaultChecklistNumber } from "@/lib/audit-checklist-helpers"
import { mapSnapshotItems } from "@/lib/audit-checklist-revision-snapshot"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

type SourceItem = {
  label: string
  sortOrder: number
  isRequired: boolean
  reference: string | null
  section: string | null
}

function toSnapshotInput(items: SourceItem[]) {
  return items.map((it, idx) => ({
    label: it.label,
    sortOrder: typeof it.sortOrder === "number" ? it.sortOrder : idx,
    isRequired: it.isRequired !== false,
    reference: it.reference,
    section: it.section,
  }))
}

/**
 * Güncel revizyonun maddelerini kopyalayarak yeni revizyon numarası oluşturur.
 * Önce kayıtlı revizyon anlık görüntüsü, yoksa veya boşsa canlı checklist maddeleri kullanılır.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const checklist = await prisma.auditChecklist.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  })

  if (!checklist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const storedNumbers = await prisma.auditChecklistRevision.findMany({
    where: { auditChecklistId: id },
    select: { revisionNumber: true },
  })
  const maxStored =
    storedNumbers.length > 0 ? Math.max(...storedNumbers.map((r) => r.revisionNumber)) : null

  const baseLatest = Math.max(checklist.latestRevisionNumber, maxStored ?? checklist.latestRevisionNumber)

  const sourceRow = await prisma.auditChecklistRevision.findUnique({
    where: {
      auditChecklistId_revisionNumber: {
        auditChecklistId: id,
        revisionNumber: baseLatest,
      },
    },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  })

  let sourceItems: SourceItem[] = []
  if (sourceRow && sourceRow.items.length > 0) {
    sourceItems = sourceRow.items.map((it) => ({
      label: it.label,
      sortOrder: it.sortOrder,
      isRequired: it.isRequired,
      reference: it.reference,
      section: it.section,
    }))
  } else {
    sourceItems = checklist.items.map((it) => ({
      label: it.label,
      sortOrder: it.sortOrder,
      isRequired: it.isRequired,
      reference: it.reference,
      section: it.section,
    }))
  }

  const snapshotItems = mapSnapshotItems(toSnapshotInput(sourceItems))
  const nextRev = baseLatest + 1
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      if (!sourceRow) {
        const baseSnapshot = mapSnapshotItems(toSnapshotInput(sourceItems))
        await tx.auditChecklistRevision.create({
          data: {
            auditChecklistId: id,
            revisionNumber: baseLatest,
            revisionDate: checklist.latestRevisionDate ?? now,
            title: checklist.title.slice(0, 400),
            description: checklist.description,
            ...(baseSnapshot.length > 0 ? { items: { create: baseSnapshot } } : {}),
          },
        })
      }

      await tx.auditChecklist.update({
        where: { id },
        data: {
          latestRevisionNumber: nextRev,
          latestRevisionDate: now,
        },
      })

      await tx.auditChecklistRevision.create({
        data: {
          auditChecklistId: id,
          revisionNumber: nextRev,
          revisionDate: now,
          title: checklist.title.slice(0, 400),
          description: checklist.description,
          ...(snapshotItems.length > 0 ? { items: { create: snapshotItems } } : {}),
        },
      })
    })

    return NextResponse.json({
      ok: true,
      revisionNumber: nextRev,
      itemCount: snapshotItems.length,
      checklistNumber: checklist.checklistNumber ?? defaultChecklistNumber(id),
    })
  } catch (e) {
    console.error("[audit-checklists create-next]", e)
    return NextResponse.json({ error: "Yeni revizyon oluşturulamadı." }, { status: 500 })
  }
}

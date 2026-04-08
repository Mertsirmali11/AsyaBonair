import { NextResponse } from "next/server"
import {
  defaultChecklistNumber,
  formatYmdUtc,
  serializeAuditChecklistItemRow,
} from "@/lib/audit-checklist-helpers"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
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

  const checklistMeta = {
    id: checklist.id,
    title: checklist.title,
    checklistNumber: checklist.checklistNumber ?? defaultChecklistNumber(checklist.id),
    initialRevisionNumber: checklist.initialRevisionNumber,
    initialRevisionDate: formatYmdUtc(checklist.initialRevisionDate),
    latestRevisionNumber: checklist.latestRevisionNumber,
    latestRevisionDate: formatYmdUtc(checklist.latestRevisionDate),
  }

  const stored = await prisma.auditChecklistRevision.findMany({
    where: { auditChecklistId: id },
    orderBy: { revisionNumber: "asc" },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  })

  const byNumber = new Map(stored.map((r) => [r.revisionNumber, r]))

  const fromRev = checklist.initialRevisionNumber
  const toRev = checklist.latestRevisionNumber

  if (stored.length === 0) {
    const revisions = []
    for (let n = fromRev; n <= toRev; n++) {
      if (n === toRev) {
        revisions.push({
          id: null,
          revisionNumber: n,
          revisionDate: formatYmdUtc(checklist.latestRevisionDate),
          title: checklist.title,
          description: checklist.description,
          items: checklist.items.map(serializeAuditChecklistItemRow),
          synthetic: true,
          missingSnapshot: false,
        })
      } else {
        revisions.push({
          id: null,
          revisionNumber: n,
          revisionDate:
            n === fromRev ? formatYmdUtc(checklist.initialRevisionDate) : "—",
          title: checklist.title,
          description: checklist.description,
          items: [],
          synthetic: true,
          missingSnapshot: true,
        })
      }
    }
    return NextResponse.json({
      checklist: checklistMeta,
      revisions,
    })
  }

  const revisions = []
  for (let n = fromRev; n <= toRev; n++) {
    const row = byNumber.get(n)
    if (row) {
      revisions.push({
        id: row.id,
        revisionNumber: row.revisionNumber,
        revisionDate: formatYmdUtc(row.revisionDate),
        title: row.title,
        description: row.description,
        items: row.items.map(serializeAuditChecklistItemRow),
        synthetic: false,
        missingSnapshot: false,
      })
    } else {
      revisions.push({
        id: null,
        revisionNumber: n,
        revisionDate: n === fromRev ? formatYmdUtc(checklist.initialRevisionDate) : "—",
        title: checklist.title,
        description: checklist.description,
        items: [],
        synthetic: true,
        missingSnapshot: true,
      })
    }
  }

  return NextResponse.json({
    checklist: checklistMeta,
    revisions,
  })
}

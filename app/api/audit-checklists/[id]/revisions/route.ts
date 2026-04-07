import { NextResponse } from "next/server"
import { defaultChecklistNumber, formatYmdUtc } from "@/lib/audit-checklist-helpers"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

function serializeRevisionItem(it: {
  id: number
  label: string
  sortOrder: number
  isRequired: boolean
}) {
  return {
    id: it.id,
    label: it.label,
    sortOrder: it.sortOrder,
    isRequired: it.isRequired,
  }
}

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

  if (stored.length > 0) {
    return NextResponse.json({
      checklist: checklistMeta,
      revisions: stored.map((r) => ({
        id: r.id,
        revisionNumber: r.revisionNumber,
        revisionDate: formatYmdUtc(r.revisionDate),
        title: r.title,
        description: r.description,
        items: r.items.map(serializeRevisionItem),
        synthetic: false,
      })),
    })
  }

  return NextResponse.json({
    checklist: checklistMeta,
    revisions: [
      {
        id: null,
        revisionNumber: checklist.latestRevisionNumber,
        revisionDate: formatYmdUtc(checklist.latestRevisionDate),
        title: checklist.title,
        description: checklist.description,
        items: checklist.items.map(serializeRevisionItem),
        synthetic: true,
      },
    ],
  })
}

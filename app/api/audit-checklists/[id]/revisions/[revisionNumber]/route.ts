import { NextResponse } from "next/server"
import { defaultChecklistNumber, formatYmdUtc } from "@/lib/audit-checklist-helpers"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string; revisionNumber: string }> }

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

  if (stored) {
    return NextResponse.json({
      checklist: checklistMeta,
      revision: {
        id: stored.id,
        revisionNumber: stored.revisionNumber,
        revisionDate: formatYmdUtc(stored.revisionDate),
        title: stored.title,
        description: stored.description,
        items: stored.items.map(serializeRevisionItem),
        synthetic: false,
      },
    })
  }

  if (revNo !== checklist.latestRevisionNumber) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 })
  }

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
      id: null,
      revisionNumber: full.latestRevisionNumber,
      revisionDate: formatYmdUtc(full.latestRevisionDate),
      title: full.title,
      description: full.description,
      items: full.items.map(serializeRevisionItem),
      synthetic: true,
    },
  })
}

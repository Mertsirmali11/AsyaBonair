import { NextResponse } from "next/server"
import { defaultChecklistNumber } from "@/lib/audit-checklist-helpers"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const auditPlanEntryId = Number((await ctx.params).id)
  if (!Number.isInteger(auditPlanEntryId) || auditPlanEntryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id: auditPlanEntryId },
    select: { id: true },
  })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rows = await prisma.auditPlanChecklistAssignment.findMany({
    where: { auditPlanEntryId },
    include: {
      checklist: {
        select: {
          id: true,
          title: true,
          checklistNumber: true,
          checklistType: true,
          latestRevisionNumber: true,
          latestRevisionDate: true,
          _count: { select: { items: true } },
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  })

  return NextResponse.json(
    rows.map((r) => ({
      assignmentId: r.id,
      checklistId: r.checklist.id,
      title: r.checklist.title,
      checklistNumber:
        r.checklist.checklistNumber ?? defaultChecklistNumber(r.checklist.id),
      checklistType: r.checklist.checklistType,
      revision: String(r.checklist.latestRevisionNumber),
      itemCount: r.checklist._count.items,
      assignedAt: r.assignedAt.toISOString(),
    }))
  )
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const auditPlanEntryId = Number((await ctx.params).id)
  if (!Number.isInteger(auditPlanEntryId) || auditPlanEntryId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id: auditPlanEntryId },
    select: { id: true },
  })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const auditChecklistId = Number((body as Record<string, unknown>).auditChecklistId)
  if (!Number.isInteger(auditChecklistId) || auditChecklistId < 1) {
    return NextResponse.json({ error: "auditChecklistId is required" }, { status: 400 })
  }

  const checklist = await prisma.auditChecklist.findFirst({
    where: { id: auditChecklistId, isActive: true },
    select: { id: true },
  })
  if (!checklist) {
    return NextResponse.json({ error: "Unknown or inactive checklist" }, { status: 400 })
  }

  try {
    const created = await prisma.auditPlanChecklistAssignment.create({
      data: {
        auditPlanEntryId,
        auditChecklistId,
      },
      include: {
        checklist: {
          select: {
            id: true,
            title: true,
            checklistNumber: true,
            checklistType: true,
            latestRevisionNumber: true,
            latestRevisionDate: true,
            _count: { select: { items: true } },
          },
        },
      },
    })

    return NextResponse.json(
      {
        assignmentId: created.id,
        checklistId: created.checklist.id,
        title: created.checklist.title,
        checklistNumber:
          created.checklist.checklistNumber ??
          defaultChecklistNumber(created.checklist.id),
        checklistType: created.checklist.checklistType,
        revision: String(created.checklist.latestRevisionNumber),
        itemCount: created.checklist._count.items,
        assignedAt: created.assignedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
      return NextResponse.json({ error: "This checklist is already assigned." }, { status: 409 })
    }
    console.error("[audit-plan checklists POST]", e)
    return NextResponse.json({ error: "Could not assign checklist." }, { status: 500 })
  }
}

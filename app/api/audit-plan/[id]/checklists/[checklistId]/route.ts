import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string; checklistId: string }> }

/** Denetimden checklist atamasını kaldırır (checklistId = şablon id) */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const p = await ctx.params
  const auditPlanEntryId = Number(p.id)
  const auditChecklistId = Number(p.checklistId)

  if (!Number.isInteger(auditPlanEntryId) || auditPlanEntryId < 1) {
    return NextResponse.json({ error: "Invalid audit id" }, { status: 400 })
  }
  if (!Number.isInteger(auditChecklistId) || auditChecklistId < 1) {
    return NextResponse.json({ error: "Invalid checklist id" }, { status: 400 })
  }

  const result = await prisma.auditPlanChecklistAssignment.deleteMany({
    where: {
      auditPlanEntryId,
      auditChecklistId,
    },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

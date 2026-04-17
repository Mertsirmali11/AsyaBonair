import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string; responseId: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, responseId } = await ctx.params
  const findingId = Number(id)
  const respId = Number(responseId)

  if (!Number.isInteger(findingId) || findingId < 1 || !Number.isInteger(respId) || respId < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const cpaStatus = typeof b.cpaStatus === "string" ? b.cpaStatus : undefined

  if (cpaStatus && !["Pending", "Accepted", "Rejected"].includes(cpaStatus))
    return NextResponse.json({ error: "Invalid cpaStatus" }, { status: 400 })

  const updated = await prisma.auditFindingResponse.update({
    where: { id: respId },
    data: {
      ...(cpaStatus ? { cpaStatus } : {}),
      ...(typeof b.rootCause === "string" ? { rootCause: b.rootCause.trim() } : {}),
      ...(typeof b.correctiveAction === "string" ? { correctiveAction: b.correctiveAction.trim() } : {}),
      ...(typeof b.preventiveAction === "string" ? { preventiveAction: b.preventiveAction.trim() } : {}),
    },
    include: {
      respondedBy: { select: { id: true, isim: true, soyisim: true } },
      attachments: true,
    },
  })

  // If CPA accepted, close the finding
  if (cpaStatus === "Accepted") {
    await prisma.auditFinding.update({
      where: { id: findingId },
      data: { status: "Closed" },
    })
  }

  return NextResponse.json(updated)
}

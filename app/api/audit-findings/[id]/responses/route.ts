import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const responses = await prisma.auditFindingResponse.findMany({
    where: { auditFindingId: id },
    orderBy: { submittedAt: "asc" },
    include: {
      respondedBy: { select: { id: true, isim: true, soyisim: true } },
      attachments: true,
    },
  })

  return NextResponse.json(responses)
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const finding = await prisma.auditFinding.findUnique({ where: { id } })
  if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const rootCause = typeof b.rootCause === "string" ? b.rootCause.trim() : null
  const correctiveAction = typeof b.correctiveAction === "string" ? b.correctiveAction.trim() : null
  const preventiveAction = typeof b.preventiveAction === "string" ? b.preventiveAction.trim() : null
  const respondedById = b.respondedById ? Number(b.respondedById) : null

  if (!rootCause && !correctiveAction && !preventiveAction)
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 })

  const created = await prisma.auditFindingResponse.create({
    data: {
      auditFindingId: id,
      rootCause,
      correctiveAction,
      preventiveAction,
      respondedById,
      cpaStatus: "Pending",
    },
    include: {
      respondedBy: { select: { id: true, isim: true, soyisim: true } },
      attachments: true,
    },
  })

  return NextResponse.json(created, { status: 201 })
}

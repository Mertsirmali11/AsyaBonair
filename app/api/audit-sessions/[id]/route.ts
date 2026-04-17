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

  const row = await prisma.auditSession.findUnique({
    where: { id },
    include: {
      checklist: {
        include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
      items: true,
      findings: {
        orderBy: { createdAt: "asc" },
        include: {
          assignedTo: { select: { id: true, isim: true, soyisim: true } },
          responses: { select: { id: true, cpaStatus: true } },
        },
      },
    },
  })

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const status = typeof b.status === "string" ? b.status : undefined

  const updated = await prisma.auditSession.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(status === "Completed" ? { completedAt: new Date() } : {}),
    },
  })

  return NextResponse.json(updated)
}

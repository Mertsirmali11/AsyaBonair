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
  const rawResponder = b.respondedById
  let respondedById: number | null = null
  if (typeof rawResponder === "number" && Number.isInteger(rawResponder) && rawResponder > 0) {
    respondedById = rawResponder
  } else if (typeof rawResponder === "string" && rawResponder.trim()) {
    const n = Number(rawResponder.trim())
    if (Number.isInteger(n) && n > 0) respondedById = n
  }

  if (!rootCause && !correctiveAction && !preventiveAction)
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 })

  if (respondedById !== null) {
    const calisan = await prisma.calisan.findUnique({ where: { id: respondedById } })
    if (!calisan)
      return NextResponse.json({ error: "Geçersiz cevaplayan kişi (çalışan bulunamadı)." }, { status: 400 })
  }

  try {
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
  } catch (e) {
    console.error("auditFindingResponse.create", e)
    return NextResponse.json(
      { error: "Cevap kaydedilemedi. Lütfen tekrar deneyin veya yöneticiye bildirin." },
      { status: 500 }
    )
  }
}

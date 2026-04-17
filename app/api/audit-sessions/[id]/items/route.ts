import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"
import { dbDateToDdMmYyyy } from "@/lib/correspondence-date"

type Ctx = { params: Promise<{ id: string }> }

/** GET: all session items with results */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const items = await prisma.auditSessionItem.findMany({
    where: { auditSessionId: id },
    include: { checklistItem: true },
  })

  return NextResponse.json(items)
}

/** PUT: upsert result for a checklist item; auto-create AuditFinding if result=U */
export async function PUT(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const b = body as Record<string, unknown>
  const auditChecklistItemId = Number(b.auditChecklistItemId)
  const result = typeof b.result === "string" ? b.result : null // S | U | NA | null
  const notes = typeof b.notes === "string" ? b.notes.trim() : null

  if (!Number.isInteger(auditChecklistItemId) || auditChecklistItemId < 1)
    return NextResponse.json({ error: "Invalid auditChecklistItemId" }, { status: 400 })

  const validResults = ["S", "U", "NA", null]
  if (!validResults.includes(result))
    return NextResponse.json({ error: "Invalid result. Use S, U, NA or null" }, { status: 400 })

  // Verify session exists and get context
  const auditSession = await prisma.auditSession.findUnique({
    where: { id },
    include: {
      entry: {
        include: {
          auditCategoryType: { select: { name: true } },
          auditSubCategoryType: { select: { name: true } },
        },
      },
    },
  })
  if (!auditSession) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  // Verify checklist item belongs to the session's checklist
  const clItem = await prisma.auditChecklistItem.findFirst({
    where: { id: auditChecklistItemId, auditChecklistId: auditSession.auditChecklistId },
  })
  if (!clItem) return NextResponse.json({ error: "Checklist item not found in this session" }, { status: 404 })

  // Upsert session item
  const sessionItem = await prisma.auditSessionItem.upsert({
    where: {
      auditSessionId_auditChecklistItemId: {
        auditSessionId: id,
        auditChecklistItemId,
      },
    },
    create: { auditSessionId: id, auditChecklistItemId, result, notes },
    update: { result, notes },
  })

  // Auto-create or remove finding based on result
  if (result === "U") {
    // Check if finding already exists for this session item
    const existingFinding = await prisma.auditFinding.findUnique({
      where: { auditSessionItemId: sessionItem.id },
    })

    if (!existingFinding) {
      // Generate finding code: BON-AF-XXX
      const count = await prisma.auditFinding.count()
      const findingCode = `BON-AF-${String(count + 1).padStart(3, "0")}`

      const cat = auditSession.entry.auditCategoryType.name
      const sub = auditSession.entry.auditSubCategoryType?.name
      const field = sub ? `${cat} — ${sub}` : cat

      const auditNumber = auditSession.entry.auditNumberPrefix
        ? `${auditSession.entry.auditNumberPrefix}-${auditSession.entry.id}`
        : `AP-${auditSession.entry.id}`

      // Due date = 60 days from now
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 60)

      await prisma.auditFinding.create({
        data: {
          findingCode,
          auditSessionId: id,
          auditSessionItemId: sessionItem.id,
          explanation: clItem.label,
          reference: clItem.reference,
          field,
          auditNumber,
          dueDate,
          status: "Open",
        },
      })
    }
  } else {
    // If result changed from U to something else, mark finding as closed or remove
    const existingFinding = await prisma.auditFinding.findUnique({
      where: { auditSessionItemId: sessionItem.id },
    })
    if (existingFinding && existingFinding.status === "Open") {
      // Check if there are responses — if so, just leave it, otherwise delete
      const responseCount = await prisma.auditFindingResponse.count({
        where: { auditFindingId: existingFinding.id },
      })
      if (responseCount === 0) {
        await prisma.auditFinding.delete({ where: { id: existingFinding.id } })
      }
    }
  }

  return NextResponse.json(sessionItem)
}

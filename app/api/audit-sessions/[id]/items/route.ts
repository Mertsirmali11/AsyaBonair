import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { upsertAuditSessionItemAnswer, syncFindingForSessionItemResult } from "@/lib/audit-session-item-answer"
import { prisma } from "@/lib/prisma-server"

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
    include: {
      checklistItem: true,
      finding: { select: { id: true, findingCode: true, findingLevel: true, findingCategory: true, status: true } },
      attachments: true,
    },
  })

  return NextResponse.json(items)
}

/**
 * PUT: upsert result for a checklist item; auto-create AuditFinding if result=U.
 * Asıl yazma/validasyon mantığı lib/audit-session-item-answer.ts'e taşındı — Manage Audit'teki
 * "Accept auditee response" akışı da (yalnızca cevap kısmını) AYNI fonksiyonu çağırır.
 */
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
  // S | U | NA | OBS | null
  const result = typeof b.result === "string" ? b.result : null
  const notes = typeof b.notes === "string" ? b.notes.trim() : null
  const auditeeNotes = typeof b.auditeeNotes === "string" ? b.auditeeNotes.trim() : null
  const rawFindingLevel = typeof b.findingLevel === "string" ? b.findingLevel : "Level1"
  const rawFindingCategory = b.findingCategory

  const answer = await upsertAuditSessionItemAnswer({
    auditSessionId: id,
    auditChecklistItemId,
    result,
    notes,
    auditeeNotes,
  })
  if (!answer.ok) return NextResponse.json({ error: answer.error }, { status: answer.status })

  const findingSync = await syncFindingForSessionItemResult({
    auditSessionId: id,
    sessionItemId: answer.sessionItem.id,
    result,
    notes,
    rawFindingLevel,
    rawFindingCategory,
  })
  if (!findingSync.ok) return NextResponse.json({ error: findingSync.error }, { status: findingSync.status })

  const updated = await prisma.auditSessionItem.findUnique({
    where: { id: answer.sessionItem.id },
    include: {
      finding: { select: { id: true, findingCode: true, findingLevel: true, findingCategory: true, status: true } },
      attachments: true,
    },
  })

  return NextResponse.json(updated)
}

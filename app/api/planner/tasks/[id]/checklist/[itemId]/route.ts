import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolvePlannerTaskAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; itemId: string }> }

/** PATCH: madde metnini ve/veya tamamlanma durumunu günceller. */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, itemId } = await ctx.params
  const taskId = Number(id)
  const itemIdNum = Number(itemId)
  if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(itemIdNum) || itemIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit || !access.calisan) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const item = await prisma.plannerChecklistItem.findFirst({ where: { id: itemIdNum, taskId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as { label?: string; isDone?: boolean } | null
  const data: Record<string, unknown> = {}
  if (typeof body?.label === "string" && body.label.trim()) data.label = body.label.trim()
  if (typeof body?.isDone === "boolean") data.isDone = body.isDone

  const updated = await prisma.plannerChecklistItem.update({ where: { id: itemIdNum }, data })

  if (typeof body?.isDone === "boolean" && body.isDone !== item.isDone) {
    try {
      await logPlannerTaskHistory(
        taskId,
        access.calisan.id,
        "CHECKLIST_ITEM_COMPLETED",
        `"${updated.label}" ${body.isDone ? "tamamlandı olarak işaretlendi" : "tekrar açıldı"}.`
      )
    } catch {
      // sessiz
    }
  }

  return NextResponse.json({ id: updated.id, label: updated.label, isDone: updated.isDone })
}

/** DELETE: checklist maddesini kaldırır. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, itemId } = await ctx.params
  const taskId = Number(id)
  const itemIdNum = Number(itemId)
  if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(itemIdNum) || itemIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const item = await prisma.plannerChecklistItem.findFirst({ where: { id: itemIdNum, taskId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.plannerChecklistItem.delete({ where: { id: itemIdNum } })
  return NextResponse.json({ ok: true })
}

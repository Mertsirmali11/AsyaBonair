import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolvePlannerTaskAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** POST: checklist'e yeni madde ekler — task'ı düzenleyebilen (canEdit) herkes ekleyebilir. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit || !access.calisan) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { label?: string } | null
  const label = typeof body?.label === "string" ? body.label.trim() : ""
  if (!label) return NextResponse.json({ error: "Madde metni zorunludur." }, { status: 400 })

  const maxOrder = await prisma.plannerChecklistItem.aggregate({ where: { taskId }, _max: { sortOrder: true } })
  const item = await prisma.plannerChecklistItem.create({
    data: { taskId, label, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })

  try {
    await logPlannerTaskHistory(taskId, access.calisan.id, "CHECKLIST_ITEM_ADDED", `Checklist maddesi eklendi: "${label}"`)
  } catch {
    // sessiz
  }

  return NextResponse.json({ id: item.id, label: item.label, isDone: item.isDone }, { status: 201 })
}

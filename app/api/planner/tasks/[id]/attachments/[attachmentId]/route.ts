import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolvePlannerTaskAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; attachmentId: string }> }

/** DELETE: eki kaldırır. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, attachmentId } = await ctx.params
  const taskId = Number(id)
  const attachmentIdNum = Number(attachmentId)
  if (!Number.isInteger(taskId) || taskId < 1 || !Number.isInteger(attachmentIdNum) || attachmentIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit || !access.calisan) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const attachment = await prisma.plannerTaskAttachment.findFirst({ where: { id: attachmentIdNum, taskId } })
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.plannerTaskAttachment.delete({ where: { id: attachmentIdNum } })

  try {
    await logPlannerTaskHistory(taskId, access.calisan.id, "ATTACHMENT_DELETED", `Dosya silindi: "${attachment.fileName}"`)
  } catch {
    // sessiz
  }

  return NextResponse.json({ ok: true })
}

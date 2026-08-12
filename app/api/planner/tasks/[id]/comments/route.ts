import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanFullName, resolvePlannerTaskAccess } from "@/lib/planner-access"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const MAX_LENGTH = 5000

/** POST: task'a yorum ekler. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const taskId = Number(id)
  if (!Number.isInteger(taskId) || taskId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerTaskAccess(taskId, session?.user?.email)
  if (!access || !access.canEdit || !access.calisan) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { body?: string } | null
  const text = typeof body?.body === "string" ? body.body.trim() : ""
  if (!text) return NextResponse.json({ error: "Yorum metni zorunludur." }, { status: 400 })
  if (text.length > MAX_LENGTH) return NextResponse.json({ error: `En fazla ${MAX_LENGTH} karakter.` }, { status: 400 })

  const comment = await prisma.plannerTaskComment.create({
    data: { taskId, authorId: access.calisan.id, body: text },
  })

  try {
    await logPlannerTaskHistory(taskId, access.calisan.id, "COMMENT_ADDED", `${calisanFullName(access.calisan)} bir yorum ekledi.`)
  } catch {
    // sessiz
  }

  return NextResponse.json(
    { id: comment.id, body: comment.body, authorName: calisanFullName(access.calisan), createdAt: comment.createdAt.toISOString() },
    { status: 201 }
  )
}

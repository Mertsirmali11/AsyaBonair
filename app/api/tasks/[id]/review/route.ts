import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Görevi atayan kişi: assignee cevabını kabul (görev kapanır) veya ret + sebep (assignee'ye geri gider).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: idParam } = await ctx.params
    const taskId = Number.parseInt(idParam, 10)
    if (Number.isNaN(taskId) || taskId < 1) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!calisan) {
      return NextResponse.json({ error: "User not found" }, { status: 403 })
    }

    const task = await prisma.meetingTask.findUnique({
      where: { id: taskId },
      select: { id: true, status: true, assignedById: true },
    })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const isAssigner = task.assignedById != null && task.assignedById === calisan.id
    const isAdmin = isAdminDepartment(session.user.departman)
    if (!isAssigner && !(isAdmin && task.assignedById == null)) {
      return NextResponse.json(
        { error: "Yalnızca görevi atayan kişi kabul / ret verebilir." },
        { status: 403 }
      )
    }

    if (task.status !== "Pending Review") {
      return NextResponse.json(
        { error: "Review is only possible while the task is waiting for your decision (Pending Review)." },
        { status: 400 }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const b = body as Record<string, unknown>
    const decision = b.decision === "accept" ? "accept" : b.decision === "reject" ? "reject" : null
    if (!decision) {
      return NextResponse.json({ error: 'Use decision: "accept" | "reject"' }, { status: 400 })
    }

    if (decision === "accept") {
      await prisma.meetingTask.update({
        where: { id: taskId },
        data: { status: "Completed", rejectionReason: null },
      })
      return NextResponse.json({ ok: true, status: "Completed" })
    }

    const reason = typeof b.reason === "string" ? b.reason.trim() : ""
    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    await prisma.taskMessage.create({
      data: {
        taskId,
        senderId: calisan.id,
        message: `[Ret — atayan]\n${reason}`,
      },
    })
    await prisma.meetingTask.update({
      where: { id: taskId },
      data: { status: "Revision Requested", rejectionReason: reason },
    })

    return NextResponse.json({ ok: true, status: "Revision Requested" })
  } catch (e) {
    console.error("[POST /api/tasks/[id]/review]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Review could not be saved" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (
      session.user.departman !== "Quality" &&
      !isAdminDepartment(session.user.departman)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: idParam } = await params
    const taskId = Number.parseInt(idParam, 10)
    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 })
    }

    const body = await req.json()
    const message = String(body.message ?? "").trim()
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!calisan) {
      return NextResponse.json({ error: "User not found" }, { status: 403 })
    }

    const task = await prisma.meetingTask.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const created = await prisma.taskMessage.create({
      data: {
        taskId,
        senderId: calisan.id,
        message,
      },
      include: { sender: { select: { isim: true, soyisim: true } } },
    })

    return NextResponse.json({
      id: created.id,
      message: created.message,
      createdAt: created.createdAt.toISOString(),
      sender: created.sender,
    })
  } catch (e) {
    console.error("[POST /api/tasks/[id]/messages]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send message" },
      { status: 500 }
    )
  }
}

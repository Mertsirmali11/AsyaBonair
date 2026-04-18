import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

type Ctx = { params: Promise<{ id: string }> }

function isStaff(departman: string | null | undefined) {
  return departman === "Quality" || isAdminDepartment(departman)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: idParam } = await ctx.params
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

    if (task.status === "Completed") {
      return NextResponse.json({ error: "Tamamlanan göreve mesaj eklenemez." }, { status: 400 })
    }

    const staff = isStaff(session.user.departman)
    const isAssignee = task.assigneeId != null && task.assigneeId === calisan.id
    const isAssigner = task.assignedById != null && task.assignedById === calisan.id

    if (!staff && !isAssignee && !isAssigner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Atanan kişi inceleme beklerken yeni mesaj gönderemez (önce atayan kabul/ret verir)
    if (isAssignee && task.status === "Pending Review") {
      return NextResponse.json(
        { error: "Görev atayanın değerlendirmesini bekliyor. Bu aşamada mesaj gönderemezsiniz." },
        { status: 400 }
      )
    }

    // Görevi atayan: mesaj yerine Kabul / Ret (Quality/Admin hariç)
    if (isAssigner && !staff) {
      return NextResponse.json(
        { error: "Görevi atayan kişi burada mesaj göndermez; sağdaki \"Kabul\" veya \"Ret\" ile değerlendirin." },
        { status: 400 }
      )
    }

    const msg = await prisma.taskMessage.create({
      data: {
        taskId,
        senderId: calisan.id,
        message,
      },
      include: { sender: { select: { isim: true, soyisim: true } } },
    })

    if (
      isAssignee &&
      (task.status === "Pending Assessment" ||
        task.status === "Revision Requested" ||
        task.status === "Open" ||
        task.status === "In Progress")
    ) {
      await prisma.meetingTask.update({
        where: { id: taskId },
        data: {
          status: "Pending Review",
          rejectionReason: null,
        },
      })
    }

    const created = msg

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

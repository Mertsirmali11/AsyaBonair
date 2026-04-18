import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { isAdminDepartment } from "@/lib/department-access"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    const isAdmin = isAdminDepartment(session.user.departman)

    const meetingIdParam = new URL(req.url).searchParams.get("meetingId")
    const meetingIdNum = meetingIdParam ? Number.parseInt(meetingIdParam, 10) : NaN
    const meetingFilter =
      meetingIdParam !== null && !Number.isNaN(meetingIdNum)
        ? { meetingId: meetingIdNum }
        : {}

    // Non-admin users only see tasks assigned to them
    const assigneeFilter =
      !isAdmin && calisan ? { assigneeId: calisan.id } : {}

    const where = { ...meetingFilter, ...assigneeFilter }

    const tasks = await prisma.meetingTask.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
        meetingId: true,
        assigneeId: true,
        assignee: { select: { isim: true, soyisim: true } },
        meeting: { select: { id: true, meetingNo: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      ...(Object.keys(where).length === 0 ? { take: 200 } : {}),
    })
    return NextResponse.json(tasks)
  } catch (e) {
    console.error("[GET /api/tasks]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tasks could not be loaded" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Only Admin may create tasks (per requirement for restricted edits/ownership).
    if (!isAdminDepartment(session.user.departman)) {
      return NextResponse.json({ error: "Only admin can create tasks" }, { status: 403 })
    }

    const calisan = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!calisan) {
      return NextResponse.json({ error: "User not found" }, { status: 403 })
    }

    const body = await req.json()
    const rawMeetingId = body.meetingId
    let meetingId: number | null = null
    if (
      rawMeetingId !== undefined &&
      rawMeetingId !== null &&
      rawMeetingId !== ""
    ) {
      const n = Number(rawMeetingId)
      if (!Number.isNaN(n) && n > 0) meetingId = n
    }
    const title = String(body.title ?? "").trim()
    const assigneeId =
      body.assigneeId !== undefined && body.assigneeId !== null && body.assigneeId !== ""
        ? Number(body.assigneeId)
        : null
    const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null
    const rawStatus = String(body.status ?? "").trim()
    const allowed = new Set([
      "Pending Assessment",
      "Pending Review",
      "Revision Requested",
      "Completed",
      "Open",
      "In Progress",
    ])
    const status = allowed.has(rawStatus) ? rawStatus : "Pending Assessment"

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const task = await prisma.meetingTask.create({
      data: {
        meetingId,
        title,
        assigneeId,
        dueDate,
        status,
        assignedById: calisan.id,
      },
      include: {
        assignee: { select: { isim: true, soyisim: true } },
        meeting: { select: { id: true, meetingNo: true, title: true } },
      },
    })

    return NextResponse.json(task)
  } catch (e) {
    console.error("[POST /api/tasks]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Task could not be created" },
      { status: 500 }
    )
  }
}

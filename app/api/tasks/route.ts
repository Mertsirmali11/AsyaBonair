import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET(req: NextRequest) {
  try {
    const meetingIdParam = new URL(req.url).searchParams.get("meetingId")
    const meetingIdNum = meetingIdParam ? Number.parseInt(meetingIdParam, 10) : NaN
    const where =
      meetingIdParam !== null && !Number.isNaN(meetingIdNum)
        ? { meetingId: meetingIdNum }
        : {}

    const tasks = await prisma.meetingTask.findMany({
      where,
      include: {
        assignee: { select: { isim: true, soyisim: true } },
        meeting: { select: { meetingNo: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      ...(Object.keys(where).length === 0 ? { take: 500 } : {}),
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
    const body = await req.json()
    const meetingId = Number(body.meetingId)
    const title = String(body.title ?? "").trim()
    const assigneeId =
      body.assigneeId !== undefined && body.assigneeId !== null && body.assigneeId !== ""
        ? Number(body.assigneeId)
        : null
    const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null
    const status = String(body.status ?? "Open")

    if (!meetingId || Number.isNaN(meetingId) || !title) {
      return NextResponse.json({ error: "meetingId and title are required" }, { status: 400 })
    }

    const task = await prisma.meetingTask.create({
      data: {
        meetingId,
        title,
        assigneeId,
        dueDate,
        status,
      },
      include: {
        assignee: { select: { isim: true, soyisim: true } },
        meeting: { select: { meetingNo: true, title: true } },
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

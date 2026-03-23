import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const tasks = await prisma.meetingTask.findMany({
    where: { meetingId: parseInt(params.id) },
    include: { assignee: { select: { isim: true, soyisim: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { title, description, assignedTo, dueDate } = body

  const task = await prisma.meetingTask.create({
    data: {
      meetingId: parseInt(params.id),
      title,
      description,
      assignedTo: assignedTo ? parseInt(assignedTo) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: "Open",
    },
    include: { assignee: { select: { isim: true, soyisim: true } } },
  })
  return NextResponse.json(task)
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  const tasks = await prisma.meetingTask.findMany({
    include: {
      assignee: { select: { isim: true, soyisim: true } },
      meeting: { select: { meetingNo: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(tasks)
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  const meetings = await prisma.meeting.findMany({
    where: {
      plannedDate: { gte: start, lt: end },
    },
    include: { meetingType: true },
    orderBy: { plannedDate: "asc" },
  })

  return NextResponse.json(meetings)
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { APP_TIMEZONE, getTodayUtcRange } from "@/lib/day-range"

export async function GET() {
  const { start, end } = getTodayUtcRange(APP_TIMEZONE)

  const meetings = await prisma.meeting.findMany({
    where: {
      plannedDate: { gte: start, lt: end },
    },
    include: { meetingType: true },
    orderBy: { plannedDate: "asc" },
  })

  return NextResponse.json(meetings)
}

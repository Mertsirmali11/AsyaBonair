import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { APP_TIMEZONE, getCalendarYmdInTimeZone } from "@/lib/day-range"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
  const dayStartUtc = new Date(Date.UTC(year, month - 1, day))
  const dayEndUtc = new Date(Date.UTC(year, month - 1, day + 1))

  const meetings = await prisma.meeting.findMany({
    where: { plannedDate: { gte: dayStartUtc, lt: dayEndUtc } },
    include: { meetingType: true },
    orderBy: { plannedDate: "asc" },
  })

  return NextResponse.json(meetings)
}

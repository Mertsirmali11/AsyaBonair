import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { findCalisanlarWithBirthdayOnCalendarDay } from "@/lib/birthdays-db"
import {
  APP_TIMEZONE,
  getCalendarYmdInTimeZone,
  getIstanbulLocalDayUtcRange,
} from "@/lib/day-range"

const ANNOUNCEMENTS_DASHBOARD_LIMIT = 80

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)

    const dayStartUtc = new Date(Date.UTC(year, month - 1, day))
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day + 1))

    const { start: hazardDayStart, end: hazardDayEnd } =
      getIstanbulLocalDayUtcRange(year, month, day)

    const [meetings, hazards, announcements, birthdays] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          plannedDate: { gte: dayStartUtc, lt: dayEndUtc },
        },
        select: {
          id: true,
          meetingNo: true,
          title: true,
          plannedDate: true,
          status: true,
          meetingType: { select: { name: true } },
        },
        orderBy: { plannedDate: "asc" },
      }),
      prisma.hazardReport.findMany({
        where: {
          createdAt: { gte: hazardDayStart, lt: hazardDayEnd },
        },
        select: {
          id: true,
          reportNo: true,
          title: true,
          eventDate: true,
          createdAt: true,
          sourceType: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        take: ANNOUNCEMENTS_DASHBOARD_LIMIT,
        include: {
          creator: {
            select: { isim: true, soyisim: true, departman: true },
          },
        },
      }),
      findCalisanlarWithBirthdayOnCalendarDay(prisma, month, day),
    ])

    return NextResponse.json(prismaJson({
      announcements,
      todayMeetings: meetings,
      todayHazards: hazards,
      birthdays,
    }))
  } catch (e) {
    console.error("GET /api/dashboard/summary:", e)
    return NextResponse.json(
      { error: "Could not load dashboard data" },
      { status: 500 }
    )
  }
}

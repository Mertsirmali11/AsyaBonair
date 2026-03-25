import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import {
  APP_TIMEZONE,
  getCalendarYmdInTimeZone,
  getIstanbulLocalDayUtcRange,
} from "@/lib/day-range"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
    /** PG `@db.Date` değerleri ilgili takvim günü için UTC gece yarısı ile saklanır. */
    const dayStartUtc = new Date(Date.UTC(year, month - 1, day))
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day + 1))
    const { start: hazardDayStart, end: hazardDayEnd } =
      getIstanbulLocalDayUtcRange(year, month, day)

    const [meetings, hazards, announcements, calisanlar] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          plannedDate: { gte: dayStartUtc, lt: dayEndUtc },
        },
        include: { meetingType: true },
        orderBy: { plannedDate: "asc" },
      }),
      /** Bugün = İstanbul takviminde `created_at` (reported at) — `event_date` değil. */
      prisma.hazardReport.findMany({
        where: {
          createdAt: { gte: hazardDayStart, lt: hazardDayEnd },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { isim: true, soyisim: true, departman: true },
          },
        },
      }),
      prisma.calisan.findMany({
        where: { dogumTarihi: { not: null } },
        select: {
          id: true,
          isim: true,
          soyisim: true,
          departman: true,
          dogumTarihi: true,
        },
      }),
    ])

    const birthdays = calisanlar.filter((c) => {
      if (!c.dogumTarihi) return false
      const d = new Date(c.dogumTarihi)
      return d.getUTCMonth() + 1 === month && d.getUTCDate() === day
    })

    return NextResponse.json({
      announcements,
      todayMeetings: meetings,
      todayHazards: hazards,
      birthdays,
    })
  } catch (e) {
    console.error("GET /api/dashboard/summary:", e)
    return NextResponse.json(
      { error: "Could not load dashboard data" },
      { status: 500 }
    )
  }
}

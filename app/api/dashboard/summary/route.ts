import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { prismaJson } from "@/lib/prisma-json"
import { findCalisanlarWithBirthdayOnCalendarDay } from "@/lib/birthdays-db"
import {
  APP_TIMEZONE,
  formatYmd,
  getCalendarYmdInTimeZone,
  getIstanbulLocalDayUtcRange,
  getUtcRangeForCalendarDate,
} from "@/lib/day-range"

const ANNOUNCEMENTS_DASHBOARD_LIMIT = 80

/** İstanbul takvim günü için YYYY-MM-DD anahtarı (görevleri bugün / sonraki günlere ayırmak için). */
function ymdKeyIstanbul(d: Date): string {
  const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE, d)
  return formatYmd(year, month, day)
}

function addCalendarDays(
  y: number,
  m: number,
  d: number,
  days: number
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const viewer = await prisma.calisan.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
    const todayYmd = formatYmd(year, month, day)
    const todayStart = getUtcRangeForCalendarDate(year, month, day).start
    const windowEnd = addCalendarDays(year, month, day, 31)
    const windowEndExclusive = getUtcRangeForCalendarDate(
      windowEnd.year,
      windowEnd.month,
      windowEnd.day
    ).start

    const dayStartUtc = new Date(Date.UTC(year, month - 1, day))
    const dayEndUtc = new Date(Date.UTC(year, month - 1, day + 1))

    const { start: hazardDayStart, end: hazardDayEnd } =
      getIstanbulLocalDayUtcRange(year, month, day)

    const [meetings, hazards, announcements, birthdays, tasksInWindow] =
      await Promise.all([
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
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
          creator: {
            select: { isim: true, soyisim: true, departman: true },
          },
        },
      }),
      findCalisanlarWithBirthdayOnCalendarDay(prisma, month, day),
      prisma.meetingTask.findMany({
        where: {
          dueDate: {
            not: null,
            gte: todayStart,
            lt: windowEndExclusive,
          },
          status: { not: "Completed" },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          meeting: {
            select: { id: true, meetingNo: true, title: true },
          },
          assignee: {
            select: { isim: true, soyisim: true },
          },
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: 80,
      }),
    ])

    const annIds = announcements.map((a) => a.id)
    let ackSet = new Set<number>()
    if (viewer && annIds.length > 0) {
      const mine = await prisma.announcementAcknowledgment.findMany({
        where: {
          calisanId: viewer.id,
          announcementId: { in: annIds },
        },
        select: { announcementId: true },
      })
      ackSet = new Set(mine.map((m) => m.announcementId))
    }

    const announcementsWithAck = announcements.map((a) => ({
      ...a,
      acknowledgedByMe: viewer ? ackSet.has(a.id) : false,
    }))

    const tasksDueToday: typeof tasksInWindow = []
    const tasksDueNext30Days: typeof tasksInWindow = []
    for (const t of tasksInWindow) {
      if (!t.dueDate) continue
      const k = ymdKeyIstanbul(t.dueDate)
      if (k === todayYmd) tasksDueToday.push(t)
      else tasksDueNext30Days.push(t)
    }

    return NextResponse.json(
      prismaJson({
        announcements: announcementsWithAck,
        todayMeetings: meetings,
        todayHazards: hazards,
        birthdays,
        tasksDueToday,
        tasksDueNext30Days,
      })
    )
  } catch (e) {
    console.error("GET /api/dashboard/summary:", e)
    return NextResponse.json(
      { error: "Could not load dashboard data" },
      { status: 500 }
    )
  }
}

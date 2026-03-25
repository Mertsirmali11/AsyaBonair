import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  try {
    const today = new Date()
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    )
    const month = today.getMonth() + 1
    const day = today.getDate()

    const [announcements, meetings, hazards, calisanlar] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { isim: true, soyisim: true, departman: true },
          },
        },
      }),
      prisma.meeting.findMany({
        where: { plannedDate: { gte: start, lt: end } },
        include: { meetingType: true },
        orderBy: { plannedDate: "asc" },
      }),
      prisma.hazardReport.findMany({
        where: { eventDate: { gte: start, lt: end } },
        orderBy: { createdAt: "desc" },
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
      return d.getMonth() + 1 === month && d.getDate() === day
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

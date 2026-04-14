import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  APP_TIMEZONE,
  formatYmd,
  getCalendarYmdInTimeZone,
} from "@/lib/day-range"
import { canViewAllHazardReports } from "@/lib/hazard-access"

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
      select: { id: true, departman: true },
    })
    if (!viewer) {
      return NextResponse.json([])
    }

    const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
    const todayYmd = formatYmd(year, month, day)

    const hazards = await prisma.hazardReport.findMany({
      where: {
        eventDate: new Date(`${todayYmd}T00:00:00.000Z`),
        ...(canViewAllHazardReports(viewer.departman)
          ? {}
          : { reportedBy: viewer.id }),
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
    })

    return NextResponse.json(hazards)
  } catch (e) {
    console.error("GET /api/dashboard/today-hazards:", e)
    return NextResponse.json(
      { error: "Could not load hazards" },
      { status: 500 }
    )
  }
}

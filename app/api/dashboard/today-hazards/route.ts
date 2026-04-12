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

    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM hazard_reports WHERE event_date = CAST(${todayYmd} AS DATE)
  `
    const ids = rows.map((r) => r.id)
    if (ids.length === 0) {
      return NextResponse.json([])
    }

    const hazards = await prisma.hazardReport.findMany({
      where: {
        id: { in: ids },
        ...(canViewAllHazardReports(viewer.departman)
          ? {}
          : { reportedBy: viewer.id }),
      },
      orderBy: { createdAt: "desc" },
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

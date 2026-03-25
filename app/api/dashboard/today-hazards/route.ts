import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import {
  APP_TIMEZONE,
  formatYmd,
  getCalendarYmdInTimeZone,
} from "@/lib/day-range"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const { year, month, day } = getCalendarYmdInTimeZone(APP_TIMEZONE)
  const todayYmd = formatYmd(year, month, day)

  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM hazard_reports WHERE event_date = CAST(${todayYmd} AS DATE)
  `
  const ids = rows.map((r) => r.id)
  const hazards =
    ids.length === 0
      ? []
      : await prisma.hazardReport.findMany({
          where: { id: { in: ids } },
          orderBy: { createdAt: "desc" },
        })

  return NextResponse.json(hazards)
}

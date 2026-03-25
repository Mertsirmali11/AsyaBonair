import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { APP_TIMEZONE, getTodayUtcRange } from "@/lib/day-range"

export async function GET() {
  const { start, end } = getTodayUtcRange(APP_TIMEZONE)

  const hazards = await prisma.hazardReport.findMany({
    where: {
      eventDate: { gte: start, lt: end },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(hazards)
}

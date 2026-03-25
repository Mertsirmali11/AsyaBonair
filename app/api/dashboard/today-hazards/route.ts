import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  const hazards = await prisma.hazardReport.findMany({
    where: {
      eventDate: { gte: start, lt: end },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(hazards)
}

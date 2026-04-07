import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

/** Bow-tie summaries for Risk Board Initial Assessment. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const boards = await prisma.safetyRiskBoard.findMany({
      select: {
        riskKey: true,
        riskTitle: true,
        probability: true,
        severity: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ boards })
  } catch (e) {
    console.error("[GET /api/safety/risk-board-summaries]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    )
  }
}

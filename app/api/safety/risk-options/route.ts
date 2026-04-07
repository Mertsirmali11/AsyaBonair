import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { RISK_BOARD_SEED_ROWS } from "@/lib/safety-risk-seed"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const options = RISK_BOARD_SEED_ROWS.map((r) => ({
    id: r.id,
    riskNo: r.riskNo,
    title: r.title,
  }))

  return NextResponse.json({ options })
}

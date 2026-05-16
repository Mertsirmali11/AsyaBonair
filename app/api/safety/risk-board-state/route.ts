import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { requireSafetyManagementApi } from "@/lib/require-safety-management-api"
import { riskBoardKeyFromTitle, SAFETY_RISK_BOARD_KEY_MAX } from "@/lib/safety-risk-board-key"
import { riskBoardStateBodySchema } from "@/lib/safety-risk-board-schema"

export async function GET(req: NextRequest) {
  try {
    const gate = await requireSafetyManagementApi()
    if (!gate.ok) return gate.response
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const riskKey = (req.nextUrl.searchParams.get("riskKey") ?? "").trim()
    if (!riskKey) {
      return NextResponse.json({ error: "riskKey required" }, { status: 400 })
    }
    if (riskKey.length > SAFETY_RISK_BOARD_KEY_MAX) {
      return NextResponse.json({ error: "riskKey too long" }, { status: 400 })
    }

    const board = await prisma.safetyRiskBoard.findUnique({
      where: { riskKey },
    })

    return NextResponse.json({ board })
  } catch (e) {
    console.error("[GET /api/safety/risk-board-state]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requireSafetyManagementApi()
    if (!gate.ok) return gate.response
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const calisanId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(calisanId) || calisanId < 1) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const json = await req.json()
    const parsed = riskBoardStateBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz gövde", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data
    const expectedKey = riskBoardKeyFromTitle(body.riskTitle)
    if (body.riskKey !== expectedKey) {
      return NextResponse.json(
        { error: "riskKey, riskTitle ile uyumlu olmalı" },
        { status: 400 }
      )
    }

    const threats = body.threats as unknown as Prisma.InputJsonValue
    const consequences = body.consequences as unknown as Prisma.InputJsonValue
    const threatOpenById = body.threatOpenById as unknown as Prisma.InputJsonValue
    const consequenceOpenById =
      body.consequenceOpenById as unknown as Prisma.InputJsonValue
    const historyPayload = body.history
    const boardHistoryJson =
      historyPayload !== undefined
        ? (historyPayload as unknown as Prisma.InputJsonValue)
        : undefined

    const board = await prisma.safetyRiskBoard.upsert({
      where: { riskKey: body.riskKey },
      create: {
        riskKey: body.riskKey,
        riskTitle: body.riskTitle,
        probability: body.probability,
        severity: body.severity,
        initialProbability: body.initialProbability,
        initialSeverity: body.initialSeverity,
        finalProbability: body.finalProbability,
        finalSeverity: body.finalSeverity,
        threats,
        consequences,
        threatOpenById,
        consequenceOpenById,
        boardHistory: boardHistoryJson ?? [],
        updatedByCalisanId: calisanId,
      },
      update: {
        riskTitle: body.riskTitle,
        probability: body.probability,
        severity: body.severity,
        initialProbability: body.initialProbability,
        initialSeverity: body.initialSeverity,
        finalProbability: body.finalProbability,
        finalSeverity: body.finalSeverity,
        threats,
        consequences,
        threatOpenById,
        consequenceOpenById,
        ...(boardHistoryJson !== undefined
          ? { boardHistory: boardHistoryJson }
          : {}),
        updatedByCalisanId: calisanId,
      },
    })

    return NextResponse.json({ board })
  } catch (e) {
    console.error("[PUT /api/safety/risk-board-state]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { requireSafetyManagementApi } from "@/lib/require-safety-management-api"
import { riskBoardKeyFromTitle } from "@/lib/safety-risk-board-key"
import { riskBoardCatalogEntriesSchema } from "@/lib/safety-risk-catalog-schema"
import type { RiskBoardSeedRow } from "@/lib/safety-risk-seed"

const MAX_BODY_BYTES = 2 * 1024 * 1024

const EMPTY_ENTRIES: RiskBoardSeedRow[] = []

function parseStoredEntries(raw: unknown): RiskBoardSeedRow[] | null {
  const parsed = riskBoardCatalogEntriesSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function baselinePrevious(
  row: { entries: unknown } | null
): RiskBoardSeedRow[] {
  if (!row) return [...EMPTY_ENTRIES]
  const entries = parseStoredEntries(row.entries)
  if (!entries) return [...EMPTY_ENTRIES]
  return entries
}

export async function GET() {
  try {
    const gate = await requireSafetyManagementApi()
    if (!gate.ok) return gate.response
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const row = await prisma.safetyRiskBoardCatalog.findUnique({
      where: { id: 1 },
    })
    if (!row) {
      return NextResponse.json({
        entries: [],
        source: "default" as const,
      })
    }
    const entries = parseStoredEntries(row.entries)
    if (entries === null) {
      return NextResponse.json({
        entries: [],
        source: "default" as const,
      })
    }
    if (entries.length === 0) {
      return NextResponse.json({ entries: [], source: "stored" as const })
    }
    return NextResponse.json({ entries, source: "stored" as const })
  } catch (e) {
    console.error("[GET /api/safety/risk-board-catalog]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
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

    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }
    let body: unknown
    try {
      body = JSON.parse(text) as unknown
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = riskBoardCatalogEntriesSchema.safeParse(
      (body as { entries?: unknown })?.entries
    )
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid entries", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const nextEntries = parsed.data

    const jsonEntries = nextEntries as unknown as Prisma.InputJsonValue

    // Reading `stored` inside the Serializable transaction ensures that two
    // concurrent PUT requests cannot both read the same previous catalog, compute
    // different diffs, and then overwrite each other's changes. PostgreSQL SSI
    // detects the read-write conflict and aborts one with P2034.
    await prisma.$transaction(
      async (tx) => {
        const stored = await tx.safetyRiskBoardCatalog.findUnique({
          where: { id: 1 },
        })
        const previous = baselinePrevious(stored)

        const nextById = new Map(nextEntries.map((r) => [r.id, r]))
        const prevById = new Map(previous.map((r) => [r.id, r]))

        const removed = previous.filter((p) => !nextById.has(p.id))
        const titleChanges: { oldTitle: string; newTitle: string }[] = []
        for (const n of nextEntries) {
          const p = prevById.get(n.id)
          if (p && p.title.trim() !== n.title.trim()) {
            titleChanges.push({ oldTitle: p.title, newTitle: n.title })
          }
        }

        for (const p of removed) {
          const key = riskBoardKeyFromTitle(p.title)
          await tx.safetyRiskBoard.deleteMany({ where: { riskKey: key } })
        }

        for (const { oldTitle, newTitle } of titleChanges) {
          const oldKey = riskBoardKeyFromTitle(oldTitle)
          const newKey = riskBoardKeyFromTitle(newTitle)
          const board = await tx.safetyRiskBoard.findUnique({
            where: { riskKey: oldKey },
          })
          if (!board) continue
          if (oldKey !== newKey) {
            const clash = await tx.safetyRiskBoard.findUnique({
              where: { riskKey: newKey },
            })
            if (clash) {
              throw new Error(
                "DUPLICATE_TITLE_KEY: Another saved risk board already uses this title."
              )
            }
          }
          await tx.safetyRiskBoard.update({
            where: { riskKey: oldKey },
            data: {
              riskKey: newKey,
              riskTitle: newTitle.trim(),
            },
          })
        }

        await tx.safetyRiskBoardCatalog.upsert({
          where: { id: 1 },
          create: { id: 1, entries: jsonEntries },
          update: { entries: jsonEntries },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    return NextResponse.json({ ok: true, entries: nextEntries })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    if (msg.startsWith("DUPLICATE_TITLE_KEY")) {
      return NextResponse.json(
        { error: msg.replace(/^DUPLICATE_TITLE_KEY: /, "") },
        { status: 409 }
      )
    }
    // P2034 = serialization failure — another concurrent request updated the
    // catalog at the same time; the client should retry.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Eşzamanlı güncelleme çakışması. Lütfen tekrar deneyin." },
        { status: 409 }
      )
    }
    console.error("[PUT /api/safety/risk-board-catalog]", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Tüm katalog satırlarını ve kayıtlı bow-tie (SafetyRiskBoard) kayıtlarını siler. */
export async function DELETE() {
  try {
    const gate = await requireSafetyManagementApi()
    if (!gate.ok) return gate.response
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.safetyRiskBoard.deleteMany({})
      await tx.safetyRiskBoardCatalog.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          entries: [] as unknown as Prisma.InputJsonValue,
        },
        update: {
          entries: [] as unknown as Prisma.InputJsonValue,
        },
      })
    })

    return NextResponse.json({ ok: true, entries: [] })
  } catch (e) {
    console.error("[DELETE /api/safety/risk-board-catalog]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    )
  }
}

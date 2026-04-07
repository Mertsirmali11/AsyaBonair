import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma-server"
import { getIstanbulTodayForDb } from "@/lib/date-format"
import { requireQualityOrAdminApi } from "@/lib/require-quality-admin-api"

const createSchema = z.object({
  text: z.string().trim().min(1).max(20000),
})

export async function GET() {
  const gate = await requireQualityOrAdminApi()
  if (!gate.ok) return gate.response

  const rows = await prisma.safetyObjective.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      sortOrder: true,
      text: true,
      insertionDate: true,
    },
  })

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const gate = await requireQualityOrAdminApi()
  if (!gate.ok) return gate.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.text?.[0] || "Invalid body" },
      { status: 400 }
    )
  }

  const maxRow = await prisma.safetyObjective.aggregate({
    _max: { sortOrder: true },
  })
  const nextOrder = (maxRow._max.sortOrder ?? 0) + 1
  const insertionDate = getIstanbulTodayForDb()

  const created = await prisma.safetyObjective.create({
    data: {
      sortOrder: nextOrder,
      text: parsed.data.text,
      insertionDate,
    },
    select: {
      id: true,
      sortOrder: true,
      text: true,
      insertionDate: true,
    },
  })

  return NextResponse.json(created, { status: 201 })
}

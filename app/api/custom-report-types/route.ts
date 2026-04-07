import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma-server"
import { requireQualityOrAdminApi } from "@/lib/require-quality-admin-api"

const createSchema = z.object({
  name: z.string().trim().min(1).max(500),
})

export async function GET() {
  const gate = await requireQualityOrAdminApi()
  if (!gate.ok) return gate.response

  const rows = await prisma.customReportType.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      sortOrder: true,
      name: true,
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
      { error: parsed.error.flatten().fieldErrors.name?.[0] || "Invalid body" },
      { status: 400 }
    )
  }

  const maxRow = await prisma.customReportType.aggregate({
    _max: { sortOrder: true },
  })
  const nextOrder = (maxRow._max.sortOrder ?? 0) + 1

  const created = await prisma.customReportType.create({
    data: {
      sortOrder: nextOrder,
      name: parsed.data.name,
    },
    select: {
      id: true,
      sortOrder: true,
      name: true,
    },
  })

  return NextResponse.json(created, { status: 201 })
}

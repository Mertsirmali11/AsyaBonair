import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma-server"
import { requireQualityOrAdminApi } from "@/lib/require-quality-admin-api"

const patchSchema = z.object({
  text: z.string().trim().min(1).max(20000),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireQualityOrAdminApi()
  if (!gate.ok) return gate.response

  const { id: idStr } = await ctx.params
  const id = parseInt(idStr, 10)
  if (Number.isNaN(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.text?.[0] || "Invalid body" },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.safetyObjective.update({
      where: { id },
      data: { text: parsed.data.text },
      select: {
        id: true,
        sortOrder: true,
        text: true,
        insertionDate: true,
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireQualityOrAdminApi()
  if (!gate.ok) return gate.response

  const { id: idStr } = await ctx.params
  const id = parseInt(idStr, 10)
  if (Number.isNaN(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    await prisma.safetyObjective.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

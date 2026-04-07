import { NextResponse } from "next/server"
import { sessionCanManageAuditCategoryTypes } from "@/lib/audit-settings-access"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

function parseOptionalSortOrder(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim())
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return undefined
}

export async function PATCH(req: Request, ctx: Ctx) {
  const m = await sessionCanManageAuditCategoryTypes()
  if (!m.ok || !m.session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const data: {
    name?: string
    sortOrder?: number
    isActive?: boolean
  } = {}

  if (typeof b.name === "string") {
    const name = b.name.trim()
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    data.name = name.slice(0, 400)
  }

  const sortParsed = parseOptionalSortOrder(b.sortOrder)
  if (sortParsed !== undefined) {
    data.sortOrder = sortParsed
  }

  if (typeof b.isActive === "boolean") {
    data.isActive = b.isActive
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const updated = await prisma.auditSubCategoryType.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const m = await sessionCanManageAuditCategoryTypes()
  if (!m.ok || !m.session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const usage = await prisma.auditPlanEntry.count({
    where: { auditSubCategoryTypeId: id },
  })

  if (usage > 0) {
    return NextResponse.json(
      {
        error:
          "This sub-category is used by audit plan entries. Deactivate it instead of deleting.",
        usedCount: usage,
      },
      { status: 409 }
    )
  }

  try {
    await prisma.auditSubCategoryType.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

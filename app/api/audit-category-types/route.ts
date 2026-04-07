import { NextResponse } from "next/server"
import { ensureDefaultAuditCategoryTypes } from "@/lib/ensure-audit-category-types"
import { ensureDefaultAuditSubCategoryTypes } from "@/lib/ensure-audit-subcategory-types"
import {
  sessionCanManageAuditCategoryTypes,
  sessionCanReadAuditCategoryTypes,
} from "@/lib/audit-settings-access"
import { prisma } from "@/lib/prisma-server"

function parseOptionalSortOrder(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim())
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return undefined
}

export async function GET(req: Request) {
  const read = await sessionCanReadAuditCategoryTypes()
  if (!read.ok || !read.session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const manage = await sessionCanManageAuditCategoryTypes()
  const url = new URL(req.url)
  const listAll = url.searchParams.get("all") === "1" && manage.ok

  await ensureDefaultAuditCategoryTypes()
  await ensureDefaultAuditSubCategoryTypes()

  const rows = await prisma.auditCategoryType.findMany({
    where: listAll ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const m = await sessionCanManageAuditCategoryTypes()
  if (!m.ok || !m.session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const description =
    typeof b.description === "string" ? b.description.trim() || null : null
  const sortOrder = parseOptionalSortOrder(b.sortOrder)

  const maxSort = await prisma.auditCategoryType.aggregate({ _max: { sortOrder: true } })
  const nextOrder =
    sortOrder !== undefined ? sortOrder : (maxSort._max.sortOrder ?? -1) + 1

  try {
    const created = await prisma.auditCategoryType.create({
      data: {
        name: name.slice(0, 400),
        description,
        sortOrder: nextOrder,
        isActive: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error("[audit-category-types POST]", e)
    return NextResponse.json(
      { error: "Could not save category. Please try again." },
      { status: 500 }
    )
  }
}

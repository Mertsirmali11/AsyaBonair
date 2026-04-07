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
  const categoryTypeId = Number(url.searchParams.get("categoryTypeId"))
  if (!Number.isInteger(categoryTypeId) || categoryTypeId < 1) {
    return NextResponse.json({ error: "categoryTypeId is required" }, { status: 400 })
  }

  const listAll = url.searchParams.get("all") === "1" && manage.ok

  await ensureDefaultAuditCategoryTypes()
  await ensureDefaultAuditSubCategoryTypes()

  const parent = await prisma.auditCategoryType.findFirst({
    where: listAll ? { id: categoryTypeId } : { id: categoryTypeId, isActive: true },
    select: { id: true },
  })
  if (!parent) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 })
  }

  const rows = await prisma.auditSubCategoryType.findMany({
    where: {
      auditCategoryTypeId: categoryTypeId,
      ...(listAll ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
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
  const auditCategoryTypeId = Number(b.auditCategoryTypeId)
  if (!Number.isInteger(auditCategoryTypeId) || auditCategoryTypeId < 1) {
    return NextResponse.json({ error: "auditCategoryTypeId is required" }, { status: 400 })
  }

  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const sortOrder = parseOptionalSortOrder(b.sortOrder)

  const parent = await prisma.auditCategoryType.findFirst({
    where: { id: auditCategoryTypeId },
    select: { id: true },
  })
  if (!parent) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 })
  }

  const maxSort = await prisma.auditSubCategoryType.aggregate({
    where: { auditCategoryTypeId },
    _max: { sortOrder: true },
  })
  const nextOrder =
    sortOrder !== undefined ? sortOrder : (maxSort._max.sortOrder ?? -1) + 1

  try {
    const created = await prisma.auditSubCategoryType.create({
      data: {
        auditCategoryTypeId,
        name: name.slice(0, 400),
        sortOrder: nextOrder,
        isActive: true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error("[audit-subcategory-types POST]", e)
    return NextResponse.json(
      { error: "Could not save sub-category." },
      { status: 500 }
    )
  }
}

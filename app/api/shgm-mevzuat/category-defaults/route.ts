import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { assertCanManageShgmMevzuat } from "@/lib/shgm/access"
import { SHGM_CATEGORY_LABELS, type ShgmCategoryKey } from "@/lib/shgm/categories"

export const runtime = "nodejs"

const VALID_CATEGORIES = new Set(Object.keys(SHGM_CATEGORY_LABELS))

export async function GET() {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) return gate.response

  const rows = await prisma.shgmCategoryDefaultDepartment.findMany()
  return NextResponse.json(rows)
}

/** Body: { category, department } — kategori başına tek varsayılan departman (upsert). */
export async function PUT(req: NextRequest) {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) return gate.response

  const body = await req.json().catch(() => ({}))
  const category = typeof body.category === "string" ? body.category.trim() : ""
  const department = typeof body.department === "string" ? body.department.trim() : ""

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }
  if (!department) {
    return NextResponse.json({ error: "Department is required" }, { status: 400 })
  }

  const row = await prisma.shgmCategoryDefaultDepartment.upsert({
    where: { category },
    create: { category: category as ShgmCategoryKey, department },
    update: { department },
  })
  return NextResponse.json(row)
}

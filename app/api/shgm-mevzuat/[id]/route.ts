import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma-server"
import { assertCanManageShgmMevzuat } from "@/lib/shgm/access"

export const runtime = "nodejs"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageShgmMevzuat()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const data: { department?: string | null; status?: string } = {}

  if ("department" in body) {
    const department = typeof body.department === "string" ? body.department.trim() : null
    data.department = department && department.length > 0 ? department : null
  }
  if ("status" in body) {
    const status = typeof body.status === "string" ? body.status.trim() : ""
    if (status !== "new" && status !== "reviewed") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    data.status = status
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const updated = await prisma.shgmRegulation.update({
      where: { id: numericId },
      data,
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

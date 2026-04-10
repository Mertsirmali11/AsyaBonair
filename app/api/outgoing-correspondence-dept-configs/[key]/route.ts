import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export const dynamic = "force-dynamic"

function normalizePrefix(s: string): string {
  const inner = s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
  return inner.replace(/^-+|-+$/g, "")
}

async function gate() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccessConfigurationsArea(session.user?.departman)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const denied = await gate()
  if (denied) return denied

  const { key: keyParam } = await params
  const key = decodeURIComponent(keyParam).trim().toLowerCase()
  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 })
  }

  const existing = await prisma.outgoingCorrespondenceDeptConfig.findUnique({
    where: { key },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const raw = body as {
    label?: unknown
    paperPrefix?: unknown
    sortOrder?: unknown
    isActive?: unknown
    includeYearInPaperNo?: unknown
  }

  const data: {
    label?: string
    paperPrefix?: string
    sortOrder?: number
    isActive?: boolean
    includeYearInPaperNo?: boolean
  } = {}

  if (typeof raw.label === "string") {
    const label = raw.label.trim()
    if (!label || label.length > 200) {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 })
    }
    data.label = label
  }
  if (typeof raw.paperPrefix === "string") {
    const prefixNorm = normalizePrefix(raw.paperPrefix)
    if (prefixNorm.length < 2 || prefixNorm.length > 50) {
      return NextResponse.json({ error: "Invalid correspondence prefix" }, { status: 400 })
    }
    data.paperPrefix = prefixNorm
  }
  if (typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)) {
    data.sortOrder = Math.floor(raw.sortOrder)
  }
  if (typeof raw.isActive === "boolean") {
    data.isActive = raw.isActive
  }
  if (typeof raw.includeYearInPaperNo === "boolean") {
    data.includeYearInPaperNo = raw.includeYearInPaperNo
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  try {
    const updated = await prisma.outgoingCorrespondenceDeptConfig.update({
      where: { key },
      data,
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "This correspondence prefix is already used by another department" },
        { status: 400 }
      )
    }
    console.error("PATCH dept config:", e)
    return NextResponse.json({ error: "Could not update department" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const denied = await gate()
  if (denied) return denied

  const { key: keyParam } = await params
  const key = decodeURIComponent(keyParam).trim().toLowerCase()
  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 })
  }

  const existing = await prisma.outgoingCorrespondenceDeptConfig.findUnique({
    where: { key },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const inUse = await prisma.outgoingCorrespondence.count({
    where: { departmentKey: key },
  })
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${inUse} outgoing correspondence(s) still use this department. Deactivate it instead or reassign records.`,
      },
      { status: 400 }
    )
  }

  try {
    await prisma.outgoingCorrespondenceDeptConfig.delete({ where: { key } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("DELETE dept config:", e)
    return NextResponse.json({ error: "Could not delete department" }, { status: 500 })
  }
}

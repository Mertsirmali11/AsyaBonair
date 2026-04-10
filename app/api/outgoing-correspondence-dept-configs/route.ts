import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma-server"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export const dynamic = "force-dynamic"

const KEY_RE = /^[a-z0-9_-]{1,40}$/

function normalizePrefix(s: string): string {
  const inner = s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
  // Drop leading/trailing hyphens so "BON-CMM-" matches stored "BON-CMM" and numbering stays PREFIX-YEAR-NNN
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

export async function GET(req: NextRequest) {
  const denied = await gate()
  if (denied) return denied

  const activeOnly = req.nextUrl.searchParams.get("active") === "1"

  const rows = await prisma.outgoingCorrespondenceDeptConfig.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const denied = await gate()
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const raw = body as {
    key?: unknown
    label?: unknown
    paperPrefix?: unknown
    sortOrder?: unknown
    isActive?: unknown
    includeYearInPaperNo?: unknown
  }
  const key = typeof raw.key === "string" ? raw.key.trim().toLowerCase() : ""
  const label = typeof raw.label === "string" ? raw.label.trim() : ""
  const paperPrefix = typeof raw.paperPrefix === "string" ? raw.paperPrefix : ""
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? Math.floor(raw.sortOrder)
      : 0
  const isActive = typeof raw.isActive === "boolean" ? raw.isActive : true
  const includeYearInPaperNo =
    typeof raw.includeYearInPaperNo === "boolean" ? raw.includeYearInPaperNo : false

  if (!KEY_RE.test(key)) {
    return NextResponse.json(
      {
        error:
          "Key must be 1–40 characters: lowercase letters, digits, hyphen, underscore only",
      },
      { status: 400 }
    )
  }
  if (!label || label.length > 200) {
    return NextResponse.json({ error: "Label is required (max 200 chars)" }, { status: 400 })
  }
  const prefixNorm = normalizePrefix(paperPrefix)
  if (prefixNorm.length < 2 || prefixNorm.length > 50) {
    return NextResponse.json(
      { error: "Correspondence prefix must be 2–50 chars (letters, digits, hyphens)" },
      { status: 400 }
    )
  }

  try {
    const created = await prisma.outgoingCorrespondenceDeptConfig.create({
      data: {
        key,
        label,
        paperPrefix: prefixNorm,
        sortOrder,
        isActive,
        includeYearInPaperNo,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A department with this key or prefix already exists" },
        { status: 400 }
      )
    }
    console.error("POST dept config:", e)
    return NextResponse.json({ error: "Could not create department" }, { status: 500 })
  }
}

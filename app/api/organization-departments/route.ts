import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import {
  ORGANIZATION_DEPARTMENTS,
  isValidCustomManualDepartment,
  mergeDepartmentLists,
} from "@/lib/organization-departments"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessConfigurationsArea(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const custom = await prisma.customDepartment.findMany({
      orderBy: { name: "asc" },
    })
    const departments = mergeDepartmentLists(
      ORGANIZATION_DEPARTMENTS,
      custom.map((c) => c.name)
    )
    return NextResponse.json({ departments })
  } catch (e) {
    console.error("GET /api/organization-departments:", e)
    return NextResponse.json(
      { error: "Could not load departments" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessConfigurationsArea(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as { name?: string }
    const raw = String(body?.name ?? "").trim()
    if (!isValidCustomManualDepartment(raw)) {
      return NextResponse.json(
        { error: "Invalid department name (1–100 characters)." },
        { status: 400 }
      )
    }

    const custom = await prisma.customDepartment.findMany()
    const merged = mergeDepartmentLists(ORGANIZATION_DEPARTMENTS, custom.map((c) => c.name))
    if (merged.some((d) => d.toLowerCase() === raw.toLowerCase())) {
      return NextResponse.json(
        { error: "This department is already in the list." },
        { status: 400 }
      )
    }

    await prisma.customDepartment.create({ data: { name: raw } })

    const updated = await prisma.customDepartment.findMany({
      orderBy: { name: "asc" },
    })
    const departments = mergeDepartmentLists(
      ORGANIZATION_DEPARTMENTS,
      updated.map((c) => c.name)
    )
    return NextResponse.json({ departments })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "This department name already exists." },
        { status: 400 }
      )
    }
    console.error("POST /api/organization-departments:", e)
    return NextResponse.json(
      { error: "Could not add department" },
      { status: 500 }
    )
  }
}

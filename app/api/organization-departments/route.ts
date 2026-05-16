import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  canAccessConfigurationsArea,
  canApproveWorkerRegistrations,
} from "@/lib/department-access"
import { isValidCustomManualDepartment } from "@/lib/organization-departments"
import { prisma } from "@/lib/prisma-server"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const dept = session.user.departman
    const mayManageConfig = canAccessConfigurationsArea(dept)
    const mayReadForApprovals = canApproveWorkerRegistrations(dept)
    if (!mayManageConfig && !mayReadForApprovals) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const custom = await prisma.customDepartment.findMany({
      orderBy: { name: "asc" },
    })
    const departments = custom.map((c) => c.name)
    return NextResponse.json({
      departments,
      customDepartments: custom.map((c) => ({ id: c.id, name: c.name })),
    })
  } catch (e) {
    console.error("GET /api/organization-departments:", e)
    return NextResponse.json(
      { error: "Departmanlar yüklenemedi." },
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
        { error: "Geçersiz departman adı (1–100 karakter, geçersiz kontrol karakterleri yok)." },
        { status: 400 }
      )
    }

    const existing = await prisma.customDepartment.findMany({
      select: { name: true },
    })
    if (existing.some((e) => e.name.toLowerCase() === raw.toLowerCase())) {
      return NextResponse.json({ error: "Bu departman adı zaten kayıtlı." }, { status: 400 })
    }

    await prisma.customDepartment.create({ data: { name: raw } })

    const updated = await prisma.customDepartment.findMany({
      orderBy: { name: "asc" },
    })
    const departments = updated.map((c) => c.name)
    return NextResponse.json({
      departments,
      customDepartments: updated.map((c) => ({ id: c.id, name: c.name })),
    })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Bu departman adı zaten kayıtlı." },
        { status: 400 }
      )
    }
    console.error("POST /api/organization-departments:", e)
    return NextResponse.json({ error: "Departman eklenemedi." }, { status: 500 })
  }
}

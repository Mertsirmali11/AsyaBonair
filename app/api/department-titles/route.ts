import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { isAdminDepartment } from "@/lib/department-access"

// ─── GET /api/department-titles ───────────────────────────────────────────────
// Herkese açık (oturum zorunlu). Departman unvanlarını listeler.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const departmentFilter = searchParams.get("department")

    const titles = await prisma.departmentTitle.findMany({
      where: departmentFilter
        ? { departmentName: { equals: departmentFilter, mode: "insensitive" } }
        : undefined,
      orderBy: [{ departmentName: "asc" }, { titleName: "asc" }],
      select: {
        id: true,
        departmentName: true,
        titleName: true,
        isManager: true,
        createdAt: true,
        _count: { select: { employees: true } },
      },
    })

    return NextResponse.json({ titles })
  } catch (e) {
    console.error("[GET /api/department-titles]", e)
    return NextResponse.json({ error: "Unvanlar yüklenemedi." }, { status: 500 })
  }
}

// ─── POST /api/department-titles ──────────────────────────────────────────────
// Yalnızca Admin departmanı oluşturabilir.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Yetki: Admin departmanı zorunlu
    const calisan = await prisma.calisan.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      select: { departman: true },
    })
    if (!isAdminDepartment(calisan?.departman)) {
      return NextResponse.json({ error: "Forbidden: sadece Admin unvan oluşturabilir." }, { status: 403 })
    }

    const body = (await req.json()) as {
      departmentName?: string
      titleName?: string
      isManager?: boolean
    }

    const departmentName = body.departmentName?.trim()
    const titleName = body.titleName?.trim()

    if (!departmentName || !titleName) {
      return NextResponse.json({ error: "departmentName ve titleName zorunlu." }, { status: 400 })
    }

    const title = await prisma.departmentTitle.create({
      data: {
        departmentName,
        titleName,
        isManager: body.isManager ?? false,
      },
    })

    return NextResponse.json({ title }, { status: 201 })
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Bu departmanda bu unvan zaten mevcut." },
        { status: 409 }
      )
    }
    console.error("[POST /api/department-titles]", e)
    return NextResponse.json({ error: "Unvan oluşturulamadı." }, { status: 500 })
  }
}

// ─── DELETE /api/department-titles?id=X ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const calisan = await prisma.calisan.findFirst({
      where: { email: { equals: session.user.email, mode: "insensitive" } },
      select: { departman: true },
    })
    if (!isAdminDepartment(calisan?.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "")
    if (isNaN(id)) {
      return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
    }

    await prisma.departmentTitle.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/department-titles]", e)
    return NextResponse.json({ error: "Unvan silinemedi." }, { status: 500 })
  }
}

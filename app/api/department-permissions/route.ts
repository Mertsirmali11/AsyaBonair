import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  canAccessConfigurationsArea,
  normalizeDepartmentKey,
} from "@/lib/department-access"
import { isKnownDepartmentPermissionKey } from "@/lib/department-permission-keys"
import { getAdminDepartmentPermissionsMatrix } from "@/lib/department-permissions-resolve"
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
    const matrix = await getAdminDepartmentPermissionsMatrix()
    return NextResponse.json(matrix)
  } catch (e) {
    console.error("GET /api/department-permissions:", e)
    return NextResponse.json(
      { error: "Yetki matrisi yüklenemedi." },
      { status: 500 }
    )
  }
}

type CellUpdate = {
  departmentKey?: string
  permissionKey?: string
  mode?: string
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessConfigurationsArea(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      updates?: CellUpdate[]
    }
    const updates = Array.isArray(body?.updates) ? body.updates : []
    if (updates.length === 0) {
      return NextResponse.json({ error: "Güncelleme listesi boş." }, { status: 400 })
    }
    if (updates.length > 500) {
      return NextResponse.json({ error: "Çok fazla satır." }, { status: 400 })
    }

    const normalized: {
      departmentKey: string
      permissionKey: string
      mode: "inherit" | "allow" | "deny"
    }[] = []

    for (const u of updates) {
      const dk = normalizeDepartmentKey(String(u.departmentKey ?? ""))
      const pk = String(u.permissionKey ?? "").trim()
      const mode = String(u.mode ?? "").trim()
      if (!dk || !pk) {
        return NextResponse.json(
          { error: "Geçersiz veya eksik departman / izin alanı." },
          { status: 400 }
        )
      }
      if (!isKnownDepartmentPermissionKey(pk)) {
        return NextResponse.json(
          { error: `Geçersiz izin anahtarı: ${pk}` },
          { status: 400 }
        )
      }
      if (mode !== "inherit" && mode !== "allow" && mode !== "deny") {
        return NextResponse.json(
          { error: "Geçersiz mod (inherit | allow | deny)." },
          { status: 400 }
        )
      }
      normalized.push({ departmentKey: dk, permissionKey: pk, mode })
    }

    if (normalized.length === 0) {
      return NextResponse.json({ error: "Geçerli güncelleme yok." }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const u of normalized) {
        if (u.mode === "inherit") {
          await tx.departmentPermission.deleteMany({
            where: {
              departmentKey: u.departmentKey,
              permissionKey: u.permissionKey,
            },
          })
        } else {
          await tx.departmentPermission.upsert({
            where: {
              departmentKey_permissionKey: {
                departmentKey: u.departmentKey,
                permissionKey: u.permissionKey,
              },
            },
            create: {
              departmentKey: u.departmentKey,
              permissionKey: u.permissionKey,
              allowed: u.mode === "allow",
            },
            update: { allowed: u.mode === "allow" },
          })
        }
      }
    })

    const matrix = await getAdminDepartmentPermissionsMatrix()
    return NextResponse.json(matrix)
  } catch (e) {
    console.error("PUT /api/department-permissions:", e)
    return NextResponse.json(
      { error: "Kayıt başarısız." },
      { status: 500 }
    )
  }
}

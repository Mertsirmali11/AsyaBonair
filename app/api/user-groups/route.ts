import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS, hasDepartmentPermission } from "@/lib/require-department-permission"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function calisanName(c: { isim: string | null; soyisim: string | null }): string {
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "—"
}

/**
 * GET: grup listesi. İki ayrı kullanım bağlamı için tek endpoint:
 * (1) Configurations → User Groups yönetim tablosu (configurations_area izni,
 * Authorization sayfasındaki override'ları da hesaba katan hasDepartmentPermission ile),
 * (2) Finding assignment picker'ında (Add Finding/Edit — canAccessAuditPlan). İkisi de zaten
 * uygulamanın güvendiği admin-tier yetkileri; ayrı bir response şekli gerektirmiyor.
 * Yazma (POST/PATCH/DELETE) SADECE configurations_area izninde — grup YÖNETİMİ Configurations'a
 * ait, finding'e atama yetkisi grup yönetme yetkisi vermez.
 */
export async function GET() {
  const session = await auth()
  const mayManage = await hasDepartmentPermission(session?.user?.departman, DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA)
  const mayUse = canAccessAuditPlan(session?.user?.email)
  if (!mayManage && !mayUse) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const groups = await prisma.userGroup.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      members: {
        select: { calisan: { select: { id: true, isim: true, soyisim: true, departman: true } } },
      },
      createdBy: { select: { isim: true, soyisim: true } },
    },
  })

  return NextResponse.json(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      members: g.members.map((m) => ({
        id: m.calisan.id,
        name: calisanName(m.calisan),
        department: m.calisan.departman,
      })),
      memberCount: g.members.length,
      createdByName: g.createdBy ? calisanName(g.createdBy) : null,
      createdAt: g.createdAt.toISOString(),
    }))
  )
}

/** POST: yeni grup oluşturur — yalnızca Configurations yetkisi olanlar. */
export async function POST(req: Request) {
  const session = await auth()
  if (!(await hasDepartmentPermission(session?.user?.departman, DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string
    description?: string | null
    memberIds?: number[]
  } | null

  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) {
    return NextResponse.json({ error: "Grup Adı zorunludur." }, { status: 400 })
  }
  const description = typeof body?.description === "string" ? body.description.trim() || null : null
  const memberIds = Array.isArray(body?.memberIds)
    ? Array.from(new Set(body!.memberIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)))
    : []
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "En az bir üye seçilmelidir." }, { status: 400 })
  }

  const existingName = await prisma.userGroup.findFirst({ where: { name, deletedAt: null } })
  if (existingName) {
    return NextResponse.json({ error: "Bu isimde bir grup zaten var." }, { status: 409 })
  }

  const actor = session?.user?.email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
        select: { id: true },
      })
    : null

  try {
    const created = await prisma.userGroup.create({
      data: {
        name,
        description,
        createdById: actor?.id ?? null,
        members: { create: memberIds.map((calisanId) => ({ calisanId })) },
      },
      include: {
        members: { select: { calisan: { select: { id: true, isim: true, soyisim: true, departman: true } } } },
      },
    })
    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        description: created.description,
        members: created.members.map((m) => ({
          id: m.calisan.id,
          name: calisanName(m.calisan),
          department: m.calisan.departman,
        })),
        memberCount: created.members.length,
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("userGroup.create", e)
    return NextResponse.json({ error: "Grup oluşturulamadı." }, { status: 500 })
  }
}

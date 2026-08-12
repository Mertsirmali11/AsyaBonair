import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Board üzerinde yeni bir plan açıldığında kullanıcıya hemen anlamlı bir başlangıç sunmak için — kaldırılabilir/yeniden adlandırılabilir. */
const DEFAULT_BUCKET_NAMES = ["Short Term", "Mid Term", "Long Term"]

/** GET: kullanıcının üyesi olduğu (silinmemiş) tüm planlar. Plan'lar üyelerine özeldir — üye olmayan hiçbir planı göremez. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true },
  })
  if (!calisan) return NextResponse.json([], { status: 200 })

  const memberships = await prisma.plannerPlanMember.findMany({
    where: { calisanId: calisan.id, plan: { deletedAt: null } },
    include: {
      plan: {
        include: {
          _count: { select: { members: true, tasks: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { plan: { createdAt: "desc" } },
  })

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.plan.id,
      name: m.plan.name,
      description: m.plan.description,
      color: m.plan.color,
      role: m.role,
      memberCount: m.plan._count.members,
      taskCount: m.plan._count.tasks,
      createdAt: m.plan.createdAt.toISOString(),
    }))
  )
}

/** POST: herhangi bir giriş yapmış kullanıcı yeni bir plan oluşturabilir — oluşturan otomatik OWNER olur. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: session.user.email, mode: "insensitive" } },
    select: { id: true },
  })
  if (!calisan) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { name?: string; description?: string; color?: string } | null
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Plan adı zorunludur." }, { status: 400 })
  const description = typeof body?.description === "string" ? body.description.trim() || null : null
  const color = typeof body?.color === "string" ? body.color.trim() || null : null

  const plan = await prisma.plannerPlan.create({
    data: {
      name,
      description,
      color,
      createdBy: calisan.id,
      members: { create: { calisanId: calisan.id, role: "OWNER" } },
      buckets: { create: DEFAULT_BUCKET_NAMES.map((n, i) => ({ name: n, sortOrder: i })) },
    },
  })

  return NextResponse.json({ id: plan.id, name: plan.name, role: "OWNER" }, { status: 201 })
}

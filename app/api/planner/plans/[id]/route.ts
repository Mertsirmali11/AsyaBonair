import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { calisanFullName, canManagePlan, resolvePlannerPlanAccess } from "@/lib/planner-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** GET: plan detayı + üye listesi + buckets. Yalnızca üyeler görebilir. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const plan = await prisma.plannerPlan.findUnique({
    where: { id: planId, deletedAt: null },
    include: {
      buckets: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      members: { include: { calisan: { select: { id: true, isim: true, soyisim: true, departman: true } } }, orderBy: { addedAt: "asc" } },
    },
  })
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    color: plan.color,
    role: access.role,
    buckets: plan.buckets.map((b) => ({ id: b.id, name: b.name, sortOrder: b.sortOrder })),
    members: plan.members.map((m) => ({
      id: m.id,
      calisanId: m.calisanId,
      name: calisanFullName(m.calisan),
      departman: m.calisan.departman,
      role: m.role,
    })),
    createdAt: plan.createdAt.toISOString(),
  })
}

/** PATCH: plan adı/açıklama/renk günceller — OWNER/MANAGER gerektirir. */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || !canManagePlan(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { name?: string; description?: string | null; color?: string | null } | null
  const data: Record<string, unknown> = {}
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (body?.description !== undefined) data.description = typeof body.description === "string" ? body.description.trim() || null : null
  if (body?.color !== undefined) data.color = typeof body.color === "string" ? body.color.trim() || null : null

  const updated = await prisma.plannerPlan.update({ where: { id: planId }, data })
  return NextResponse.json({ id: updated.id, name: updated.name, description: updated.description, color: updated.color })
}

/**
 * DELETE: planı SOFT DELETE eder (deletedAt) — hiçbir zaman hard delete yapılmaz, tüm
 * bucket/task/history kalıcı olarak veritabanında kalır, yalnızca listelerden gizlenir.
 * Yalnızca OWNER silebilir (MANAGER değil — plan'ın tamamen kapatılması en yüksek yetki gerektirir).
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || access.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.plannerPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

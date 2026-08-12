import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canManagePlan, resolvePlannerPlanAccess } from "@/lib/planner-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; bucketId: string }> }

/** PATCH: bucket adını ve/veya sırasını (kolonların sırası) günceller — OWNER/MANAGER gerektirir. */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, bucketId } = await ctx.params
  const planId = Number(id)
  const bucketIdNum = Number(bucketId)
  if (!Number.isInteger(planId) || planId < 1 || !Number.isInteger(bucketIdNum) || bucketIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || !canManagePlan(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const bucket = await prisma.plannerBucket.findFirst({ where: { id: bucketIdNum, planId, deletedAt: null } })
  if (!bucket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as { name?: string; sortOrder?: number } | null
  const data: Record<string, unknown> = {}
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)) data.sortOrder = body.sortOrder

  const updated = await prisma.plannerBucket.update({ where: { id: bucketIdNum }, data })
  return NextResponse.json({ id: updated.id, name: updated.name, sortOrder: updated.sortOrder })
}

/**
 * DELETE: bucket'ı SOFT DELETE eder — OWNER/MANAGER gerektirir. İçinde aktif
 * (silinmemiş) task varsa reddedilir; kullanıcı önce task'ları taşımalı/silmelidir
 * (sessiz veri kaybı olmasın diye).
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, bucketId } = await ctx.params
  const planId = Number(id)
  const bucketIdNum = Number(bucketId)
  if (!Number.isInteger(planId) || planId < 1 || !Number.isInteger(bucketIdNum) || bucketIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || !canManagePlan(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const bucket = await prisma.plannerBucket.findFirst({ where: { id: bucketIdNum, planId, deletedAt: null } })
  if (!bucket) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const activeTaskCount = await prisma.plannerTask.count({ where: { bucketId: bucketIdNum, deletedAt: null } })
  if (activeTaskCount > 0) {
    return NextResponse.json(
      { error: `Bu bucket'ta ${activeTaskCount} aktif görev var. Silmeden önce görevleri başka bir bucket'a taşıyın veya silin.` },
      { status: 400 }
    )
  }

  await prisma.plannerBucket.update({ where: { id: bucketIdNum }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

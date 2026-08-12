import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canManagePlan, resolvePlannerPlanAccess } from "@/lib/planner-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** POST: yeni bucket (kolon) oluşturur — OWNER/MANAGER gerektirir. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || !canManagePlan(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { name?: string } | null
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Bucket adı zorunludur." }, { status: 400 })

  const maxOrder = await prisma.plannerBucket.aggregate({
    where: { planId, deletedAt: null },
    _max: { sortOrder: true },
  })

  const bucket = await prisma.plannerBucket.create({
    data: { planId, name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  })

  return NextResponse.json({ id: bucket.id, name: bucket.name, sortOrder: bucket.sortOrder }, { status: 201 })
}

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canManagePlan, resolvePlannerPlanAccess } from "@/lib/planner-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const VALID_ROLES = ["OWNER", "MANAGER", "MEMBER"]

/** POST: plana üye ekler — OWNER/MANAGER gerektirir; yalnızca OWNER başka birine OWNER rolü verebilir. */
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id } = await ctx.params
  const planId = Number(id)
  if (!Number.isInteger(planId) || planId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const access = await resolvePlannerPlanAccess(planId, session?.user?.email)
  if (!access.isMember || !canManagePlan(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => null)) as { calisanId?: number; role?: string } | null
  const calisanId = Number(body?.calisanId)
  if (!Number.isInteger(calisanId) || calisanId < 1) return NextResponse.json({ error: "Invalid calisanId" }, { status: 400 })

  const role = typeof body?.role === "string" && VALID_ROLES.includes(body.role) ? body.role : "MEMBER"
  if (role === "OWNER" && access.role !== "OWNER") {
    return NextResponse.json({ error: "Yalnızca OWNER başka birine OWNER rolü verebilir." }, { status: 403 })
  }

  const target = await prisma.calisan.findUnique({ where: { id: calisanId }, select: { id: true } })
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })

  const member = await prisma.plannerPlanMember.upsert({
    where: { planId_calisanId: { planId, calisanId } },
    update: { role },
    create: { planId, calisanId, role },
  })

  return NextResponse.json({ id: member.id, calisanId: member.calisanId, role: member.role }, { status: 201 })
}

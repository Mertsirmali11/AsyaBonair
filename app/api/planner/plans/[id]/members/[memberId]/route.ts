import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canManagePlan, resolvePlannerPlanAccess } from "@/lib/planner-access"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string; memberId: string }> }

const VALID_ROLES = ["OWNER", "MANAGER", "MEMBER"]

async function guardAndLoadMember(planId: number, memberId: number, email: string | null | undefined) {
  const access = await resolvePlannerPlanAccess(planId, email)
  if (!access.isMember || !canManagePlan(access.role)) return { error: "Forbidden" as const, status: 403 }

  const member = await prisma.plannerPlanMember.findFirst({ where: { id: memberId, planId } })
  if (!member) return { error: "Not found" as const, status: 404 }

  return { access, member }
}

/** PATCH: üye rolünü değiştirir — yalnızca OWNER, OWNER rolü verebilir/geri alabilir. */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, memberId } = await ctx.params
  const planId = Number(id)
  const memberIdNum = Number(memberId)
  if (!Number.isInteger(planId) || planId < 1 || !Number.isInteger(memberIdNum) || memberIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const guard = await guardAndLoadMember(planId, memberIdNum, session?.user?.email)
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await req.json().catch(() => null)) as { role?: string } | null
  const role = typeof body?.role === "string" ? body.role : ""
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  if ((role === "OWNER" || guard.member.role === "OWNER") && guard.access.role !== "OWNER") {
    return NextResponse.json({ error: "Yalnızca OWNER, OWNER rolünü değiştirebilir." }, { status: 403 })
  }

  const updated = await prisma.plannerPlanMember.update({ where: { id: memberIdNum }, data: { role } })
  return NextResponse.json({ id: updated.id, role: updated.role })
}

/** DELETE: üyeyi plandan çıkarır — son OWNER kaldırılamaz (yetim plan olmasın diye). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const { id, memberId } = await ctx.params
  const planId = Number(id)
  const memberIdNum = Number(memberId)
  if (!Number.isInteger(planId) || planId < 1 || !Number.isInteger(memberIdNum) || memberIdNum < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const guard = await guardAndLoadMember(planId, memberIdNum, session?.user?.email)
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  if (guard.member.role === "OWNER") {
    const ownerCount = await prisma.plannerPlanMember.count({ where: { planId, role: "OWNER" } })
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Planın en az bir OWNER'ı olmalıdır." }, { status: 400 })
    }
  }

  await prisma.plannerPlanMember.delete({ where: { id: memberIdNum } })
  return NextResponse.json({ ok: true })
}

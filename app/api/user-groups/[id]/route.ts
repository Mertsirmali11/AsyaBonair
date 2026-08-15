import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS, hasDepartmentPermission } from "@/lib/require-department-permission"
import { prisma } from "@/lib/prisma-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null }): string {
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "—"
}

/**
 * PATCH: grup adı/açıklaması/üyeleri güncellenir — üyeler TAM DEĞİŞTİRME (verilen memberIds
 * seti nihai üye listesidir; DB'de olup listede olmayanlar çıkarılır, listede olup DB'de
 * olmayanlar eklenir). Yalnızca Configurations yetkisi olanlar.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  if (!(await hasDepartmentPermission(session?.user?.departman, DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.userGroup.findFirst({
    where: { id, deletedAt: null },
    include: { members: { select: { calisanId: true } } },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json().catch(() => null)) as {
    name?: string
    description?: string | null
    memberIds?: number[]
  } | null

  const data: { name?: string; description?: string | null } = {}
  if (typeof body?.name === "string") {
    const v = body.name.trim()
    if (!v) return NextResponse.json({ error: "Grup Adı zorunludur." }, { status: 400 })
    if (v !== existing.name) {
      const clash = await prisma.userGroup.findFirst({ where: { name: v, deletedAt: null, id: { not: id } } })
      if (clash) return NextResponse.json({ error: "Bu isimde başka bir grup zaten var." }, { status: 409 })
      data.name = v
    }
  }
  if (body?.description !== undefined) {
    data.description = typeof body.description === "string" ? body.description.trim() || null : null
  }

  const memberIds = Array.isArray(body?.memberIds)
    ? Array.from(new Set(body!.memberIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)))
    : undefined
  if (memberIds !== undefined && memberIds.length === 0) {
    return NextResponse.json({ error: "En az bir üye kalmalıdır." }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.userGroup.update({ where: { id }, data })
      }
      if (memberIds !== undefined) {
        const currentIds = new Set(existing.members.map((m) => m.calisanId))
        const nextIds = new Set(memberIds)
        const toRemove = [...currentIds].filter((cid) => !nextIds.has(cid))
        const toAdd = [...nextIds].filter((cid) => !currentIds.has(cid))
        if (toRemove.length > 0) {
          await tx.userGroupMember.deleteMany({ where: { groupId: id, calisanId: { in: toRemove } } })
        }
        if (toAdd.length > 0) {
          await tx.userGroupMember.createMany({
            data: toAdd.map((calisanId) => ({ groupId: id, calisanId })),
          })
        }
      }
    })
  } catch (e) {
    console.error("userGroup.update", e)
    return NextResponse.json({ error: "Grup güncellenemedi." }, { status: 500 })
  }

  const updated = await prisma.userGroup.findUnique({
    where: { id },
    include: {
      members: { select: { calisan: { select: { id: true, isim: true, soyisim: true, departman: true } } } },
    },
  })
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    members: updated.members.map((m) => ({
      id: m.calisan.id,
      name: calisanName(m.calisan),
      department: m.calisan.departman,
    })),
    memberCount: updated.members.length,
  })
}

/**
 * DELETE: grubu soft-delete eder (deletedAt) — hard delete YAPMAZ (kendisine atanmış kapalı/
 * geçmiş bulguların audit trail'i kaybolmasın diye). Açık (status !== Closed) bir bulgu bu
 * gruba atanmışsa 409 ile REDDEDİLİR — force delete YOKTUR; admin önce bu bulguları başka bir
 * kişiye/gruba yeniden atamalı.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!(await hasDepartmentPermission(session?.user?.departman, DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.userGroup.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const openFindings = await prisma.auditFinding.findMany({
    where: { assignedGroupId: id, deletedAt: null, status: { not: "Closed" } },
    select: { findingCode: true },
    take: 10,
  })
  if (openFindings.length > 0) {
    const codes = openFindings.map((f) => f.findingCode).join(", ")
    return NextResponse.json(
      {
        error:
          `"${existing.name}" grubuna atanmış ${openFindings.length} açık bulgu var (${codes}${openFindings.length === 10 ? ", …" : ""}). ` +
          `Silmeden önce bu bulguları başka bir kişiye veya gruba yeniden atayın.`,
      },
      { status: 409 }
    )
  }

  await prisma.userGroup.update({ where: { id }, data: { deletedAt: new Date() } })

  return NextResponse.json({ success: true })
}

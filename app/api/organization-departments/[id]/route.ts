import { NextResponse } from "next/server"
import { WorkerRegistrationStatus } from "@prisma/client"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { isValidCustomManualDepartment } from "@/lib/organization-departments"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

async function jsonDepartmentsPayload() {
  const custom = await prisma.customDepartment.findMany({
    orderBy: { name: "asc" },
  })
  const departments = custom.map((c) => c.name)
  return {
    departments,
    customDepartments: custom.map((c) => ({ id: c.id, name: c.name })),
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessConfigurationsArea(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const id = Number((await ctx.params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 })
    }
    const nameRaw =
      typeof (body as { name?: unknown }).name === "string"
        ? (body as { name: string }).name
        : ""
    const newName = nameRaw.trim()
    if (!isValidCustomManualDepartment(newName)) {
      return NextResponse.json(
        { error: "Geçersiz departman adı (1–100 karakter)." },
        { status: 400 }
      )
    }

    const row = await prisma.customDepartment.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    }

    if (newName.toLowerCase() !== row.name.toLowerCase()) {
      const lower = newName.toLowerCase()
      const siblings = await prisma.customDepartment.findMany({
        where: { id: { not: id } },
        select: { name: true },
      })
      if (siblings.some((s) => s.name.toLowerCase() === lower)) {
        return NextResponse.json(
          { error: "Bu departman adı zaten kullanılıyor." },
          { status: 400 }
        )
      }
    }

    const oldName = row.name

    await prisma.$transaction(async (tx) => {
      await tx.customDepartment.update({
        where: { id },
        data: { name: newName },
      })
      if (newName !== oldName) {
        await tx.calisan.updateMany({
          where: { departman: oldName },
          data: { departman: newName },
        })
        await tx.workerRegistrationRequest.updateMany({
          where: { departman: oldName },
          data: { departman: newName },
        })
      }
    })

    const payload = await jsonDepartmentsPayload()
    return NextResponse.json(payload)
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Bu departman adı zaten kullanılıyor." },
        { status: 400 }
      )
    }
    console.error("[organization-departments PATCH]", e)
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessConfigurationsArea(session.user.departman)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const id = Number((await ctx.params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Geçersiz kayıt." }, { status: 400 })
    }

    const row = await prisma.customDepartment.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    }

    const assigned = await prisma.calisan.count({
      where: { departman: row.name },
    })
    if (assigned > 0) {
      return NextResponse.json(
        {
          error: `Bu departmanda ${assigned} çalışan kayıtlı. Önce kullanıcı ayarlarından departmanlarını değiştirin.`,
          assignedCount: assigned,
        },
        { status: 409 }
      )
    }

    const pendingRegs = await prisma.workerRegistrationRequest.count({
      where: {
        departman: row.name,
        status: WorkerRegistrationStatus.PENDING,
      },
    })
    if (pendingRegs > 0) {
      return NextResponse.json(
        {
          error: `Bu departmanla ${pendingRegs} bekleyen kayıt başvurusu var. Önce onaylayın veya reddedin.`,
          pendingRegistrationCount: pendingRegs,
        },
        { status: 409 }
      )
    }

    await prisma.customDepartment.delete({ where: { id } })

    const payload = await jsonDepartmentsPayload()
    return NextResponse.json(payload)
  } catch (e) {
    console.error("[organization-departments DELETE]", e)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}

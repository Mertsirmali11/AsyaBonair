import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  canManageAllDepartmentForms,
  canViewDepartmentFormRow,
  effectiveDepartmanForDepartmentForms,
} from "@/lib/department-form-access"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const email = (session.user.email ?? "").trim()
  const calisan = email
    ? await prisma.calisan.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { departman: true },
      })
    : null
  const departman = effectiveDepartmanForDepartmentForms(
    calisan?.departman,
    session.user.departman
  )

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  if (!canManageAllDepartmentForms(departman)) {
    return NextResponse.json(
      { error: "Yalnızca Admin güncel revizyonu arşivleyebilir." },
      { status: 403 }
    )
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const row = await tx.departmentProcedure.findUnique({
        where: { id: numericId },
        select: {
          id: true,
          seriesId: true,
          isCurrent: true,
          department: true,
        },
      })
      if (!row) return { ok: false as const, code: "NOT_FOUND" as const }
      if (!canViewDepartmentFormRow(departman, row.department)) {
        return { ok: false as const, code: "FORBIDDEN" as const }
      }
      if (!row.isCurrent) return { ok: false as const, code: "NOT_CURRENT" as const }

      const cnt = await tx.departmentProcedure.count({
        where: { seriesId: row.seriesId },
      })

      if (cnt < 2) {
        await tx.departmentProcedure.update({
          where: { id: row.id },
          data: { isCurrent: false },
        })
        return { ok: true as const }
      }

      const successor = await tx.departmentProcedure.findFirst({
        where: { seriesId: row.seriesId, id: { not: row.id } },
        orderBy: { revision: "desc" },
        select: { id: true },
      })
      if (!successor) {
        return { ok: false as const, code: "NO_SUCCESSOR" as const }
      }

      await tx.departmentProcedure.updateMany({
        where: { seriesId: row.seriesId },
        data: { isCurrent: false },
      })
      await tx.departmentProcedure.update({
        where: { id: successor.id },
        data: { isCurrent: true },
      })
      return { ok: true as const }
    })

    if (!outcome.ok) {
      if (outcome.code === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (outcome.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      if (outcome.code === "NOT_CURRENT") {
        return NextResponse.json(
          { error: "Bu satır güncel değil; yalnızca güncel revizyon arşivlenebilir." },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: "Arşivlenemedi." }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("archive-current department-procedure:", e)
    return NextResponse.json({ error: "Arşivlenemedi." }, { status: 500 })
  }
}

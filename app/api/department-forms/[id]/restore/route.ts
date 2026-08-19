import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  canViewDepartmentFormRow,
  effectiveDepartmanForDepartmentForms,
} from "@/lib/department-form-access"

/**
 * Arşivlenmiş (isCurrent=false, serisinde başka güncel satır kalmamış) bir
 * revizyonu tekrar güncel yapar. archive-current'ın tersi; aynı transaction
 * ve izolasyon deseni kullanılır — seride başka bir satır hâlâ isCurrent=true
 * ise (beklenmeyen durum) önce o satır isCurrent=false yapılır, ardından bu
 * satır isCurrent=true yapılır; böylece serilerde her zaman en fazla bir
 * güncel satır kalır.
 */
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

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const row = await tx.departmentForm.findUnique({
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
        if (row.isCurrent) return { ok: false as const, code: "ALREADY_CURRENT" as const }

        await tx.departmentForm.updateMany({
          where: { seriesId: row.seriesId, isCurrent: true },
          data: { isCurrent: false },
        })
        await tx.departmentForm.update({
          where: { id: row.id },
          data: { isCurrent: true },
        })
        return { ok: true as const }
      },
      {
        // Serializable isolation prevents a race where a concurrent restore
        // or new-revision upload on the same series both end up current.
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    if (!outcome.ok) {
      if (outcome.code === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (outcome.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      if (outcome.code === "ALREADY_CURRENT") {
        return NextResponse.json(
          { error: "Bu satır zaten güncel; arşivden çıkarmaya gerek yok." },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: "Arşivden çıkarılamadı." }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("restore department-form:", e)
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Eşzamanlı işlem çakışması. Lütfen sayfayı yenileyip tekrar deneyin." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Arşivden çıkarılamadı." }, { status: 500 })
  }
}

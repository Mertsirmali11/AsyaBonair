import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageAnnouncements } from "@/lib/announcements-access"
import { isAdminDepartment } from "@/lib/department-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const manual = await prisma.companyManual.findUnique({
    where: { id: numericId },
    select: { id: true, title: true, contentText: true, isCurrent: true },
  })

  if (!manual) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!manual.isCurrent && !isAdminDepartment(session.user.departman)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    manual: {
      id: manual.id,
      title: manual.title,
      contentText: manual.contentText,
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageAnnouncements()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const row = await tx.companyManual.findUnique({
        where: { id: numericId },
        select: { id: true, seriesId: true, isCurrent: true },
      })
      if (!row) return { deleted: false as const }
      await tx.companyManual.delete({ where: { id: numericId } })
      if (row.isCurrent) {
        const promoted = await tx.companyManual.findFirst({
          where: { seriesId: row.seriesId },
          orderBy: { revision: "desc" },
          select: { id: true },
        })
        if (promoted) {
          await tx.companyManual.update({
            where: { id: promoted.id },
            data: { isCurrent: true },
          })
        }
      }
      return { deleted: true as const }
    })
    if (!outcome.deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("DELETE manual:", e)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}

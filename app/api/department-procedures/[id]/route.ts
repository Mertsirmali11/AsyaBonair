import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import {
  canManageAllDepartmentForms,
  canViewDepartmentFormRow,
  effectiveDepartmanForDepartmentForms,
  normalizeDeptLabel,
} from "@/lib/department-form-access"
import { deletePdfFromStorage } from "@/lib/supabase-storage"

async function viewerDepartman() {
  const session = await auth()
  if (!session?.user?.email) return { error: 401 as const, departman: null as string | null }
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
  return { error: null as null, departman }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, departman } = await viewerDepartman()
  if (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const row = await prisma.departmentProcedure.findUnique({
    where: { id: numericId },
    select: {
      id: true,
      title: true,
      contentText: true,
      isCurrent: true,
      department: true,
      fileStoragePath: true,
    },
  })

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const manageAll = canManageAllDepartmentForms(departman)
  const sameDept =
    normalizeDeptLabel(departman) === normalizeDeptLabel(row.department)
  if (row.isCurrent) {
    if (!manageAll && !sameDept) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  } else if (!manageAll && !sameDept) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    procedure: {
      id: row.id,
      title: row.title,
      contentText: row.contentText,
      hasOriginalFile: Boolean(row.fileStoragePath?.trim()),
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, departman } = await viewerDepartman()
  if (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  if (!canManageAllDepartmentForms(departman)) {
    return NextResponse.json(
      { error: "Yalnızca Admin prosedür silebilir." },
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
          fileStoragePath: true,
        },
      })
      if (!row) return { kind: "not_found" as const }
      if (!canViewDepartmentFormRow(departman, row.department)) {
        return { kind: "forbidden" as const }
      }
      const storagePath = row.fileStoragePath?.trim() || null
      await tx.departmentProcedure.delete({ where: { id: numericId } })
      if (row.isCurrent) {
        const promoted = await tx.departmentProcedure.findFirst({
          where: { seriesId: row.seriesId },
          orderBy: { revision: "desc" },
          select: { id: true },
        })
        if (promoted) {
          await tx.departmentProcedure.update({
            where: { id: promoted.id },
            data: { isCurrent: true },
          })
        }
      }
      return { kind: "deleted" as const, storagePath }
    })
    if (outcome.kind === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (outcome.storagePath) {
      void deletePdfFromStorage(outcome.storagePath)
    }
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("DELETE department-procedure:", e)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}

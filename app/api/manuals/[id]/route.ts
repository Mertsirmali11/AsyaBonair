import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma-server"
import { assertCanManageCompanyManuals } from "@/lib/announcements-access"
import { isAdminDepartment } from "@/lib/department-access"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import {
  fetchRegisteredDepartmentNames,
  isDepartmentInRegistry,
  isValidCustomManualDepartment,
} from "@/lib/organization-departments"
import { deleteCompanyManualFile } from "@/lib/company-manuals-storage"
import { indexManualChunks } from "@/lib/manual-chunk-indexer"

function parseOptionalRevisionDateBody(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageCompanyManuals()
  if (!gate.ok) return gate.response

  const { id } = await params
  const numericId = Number.parseInt(id, 10)
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 })
  }

  // ── Approve / Reject shortcut ─────────────────────────────────────────────
  if (body.action === "approve" || body.action === "reject") {
    if (body.action === "reject" && !body.reason) {
      return NextResponse.json({ error: "Red nedeni gerekli." }, { status: 400 })
    }
    const updated = await prisma.companyManual.update({
      where: { id: numericId },
      data: {
        status: body.action === "approve" ? "approved" : "rejected",
        rejectionReason: body.action === "reject" ? String(body.reason).trim() : null,
      },
      select: { id: true, status: true, rejectionReason: true, contentText: true },
    })
    // Onaylanınca chunk'ları asenkron indexle
    if (body.action === "approve") {
      indexManualChunks(updated.id, updated.contentText).catch((e) =>
        console.error("[manuals] chunk index (approve):", e)
      )
    }
    const { contentText: _ct, ...rest } = updated
    return NextResponse.json(rest)
  }

  const existing = await prisma.companyManual.findUnique({
    where: { id: numericId },
    select: { id: true, isCurrent: true, title: true, slug: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!existing.isCurrent) {
    return NextResponse.json(
      { error: "Yalnızca güncel revizyonun bilgileri düzenlenebilir." },
      { status: 400 }
    )
  }

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 300) : ""
  const departmentMode =
    typeof body.departmentMode === "string" &&
    body.departmentMode.trim().toLowerCase() === "custom"
      ? "custom"
      : "list"
  const departmentRaw =
    typeof body.department === "string" ? body.department.trim() : ""
  const manualNumber =
    typeof body.manualNumber === "string"
      ? body.manualNumber.trim().slice(0, 120)
      : ""
  const revisionDateParsed = parseOptionalRevisionDateBody(body.revisionDate)

  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 })
  }

  const opts = await fetchRegisteredDepartmentNames(prisma)

  if (departmentMode === "custom") {
    if (!isValidCustomManualDepartment(departmentRaw)) {
      return NextResponse.json(
        {
          error:
            "Özel departman 1–100 karakter olmalı; boş veya geçersiz karakter kullanılamaz.",
        },
        { status: 400 }
      )
    }
  } else if (!isDepartmentInRegistry(departmentRaw, opts)) {
    return NextResponse.json(
      { error: "Listeden kayıtlı bir departman seçin (Configurations → Departmanlar)." },
      { status: 400 }
    )
  }

  const department = departmentRaw

  let nextSlug = existing.slug
  if (title !== existing.title) {
    const baseSlug = slugifyManualTitle(title)
    let slug = baseSlug
    let n = 0
    while (
      await prisma.companyManual.findFirst({
        where: { slug, NOT: { id: numericId } },
        select: { id: true },
      })
    ) {
      n += 1
      slug = `${baseSlug}-${n}`.slice(0, 160)
    }
    nextSlug = slug
  }

  const updated = await prisma.companyManual.update({
    where: { id: numericId },
    data: {
      title,
      slug: nextSlug,
      department,
      manualNumber: manualNumber || null,
      revisionDate: revisionDateParsed,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      department: true,
      manualNumber: true,
      revisionDate: true,
      revision: true,
      seriesId: true,
      isCurrent: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    ...updated,
    revisionDate: updated.revisionDate
      ? updated.revisionDate.toISOString().slice(0, 10)
      : null,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await assertCanManageCompanyManuals()
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
        select: {
          id: true,
          seriesId: true,
          isCurrent: true,
          fileStoragePath: true,
        },
      })
      if (!row) return { deleted: false as const, storagePath: null as string | null }
      const storagePath = row.fileStoragePath
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
      return { deleted: true as const, storagePath }
    })
    if (!outcome.deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    await deleteCompanyManualFile(outcome.storagePath)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("DELETE manual:", e)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}

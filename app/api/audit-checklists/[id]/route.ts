import { NextResponse } from "next/server"
import { defaultChecklistNumber } from "@/lib/audit-checklist-helpers"
import { mapSnapshotItems } from "@/lib/audit-checklist-revision-snapshot"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

const DEFAULT_TYPE = "Classic (Satisfactory/Unsatisfactory)"

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const row = await prisma.auditChecklist.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  })

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(row)
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.auditChecklist.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  const title = typeof b.title === "string" ? b.title.trim() : ""
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const checklistType =
    typeof b.checklistType === "string" && b.checklistType.trim()
      ? b.checklistType.trim().slice(0, 200)
      : existing.checklistType || DEFAULT_TYPE

  const customNumber =
    typeof b.checklistNumber === "string" && b.checklistNumber.trim()
      ? b.checklistNumber.trim().slice(0, 100)
      : null

  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim() : null

  const isActive = typeof b.isActive === "boolean" ? b.isActive : existing.isActive

  const bumpRevision = b.bumpRevision !== false

  const itemsRaw = Array.isArray(b.items) ? b.items : []
  const items = itemsRaw
    .map((row, idx) => {
      if (!row || typeof row !== "object") return null
      const r = row as Record<string, unknown>
      const label = typeof r.label === "string" ? r.label.trim() : ""
      if (!label) return null
      const sortOrder =
        typeof r.sortOrder === "number" && Number.isFinite(r.sortOrder)
          ? Math.trunc(r.sortOrder)
          : idx
      return { label: label.slice(0, 8000), sortOrder }
    })
    .filter(Boolean) as { label: string; sortOrder: number }[]

  const now = new Date()
  const nextLatestRev = bumpRevision
    ? existing.latestRevisionNumber + 1
    : existing.latestRevisionNumber

  const snapshotItems = mapSnapshotItems(items)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditChecklistItem.deleteMany({ where: { auditChecklistId: id } })
      await tx.auditChecklist.update({
        where: { id },
        data: {
          title: title.slice(0, 400),
          checklistType,
          checklistNumber: customNumber ?? existing.checklistNumber ?? defaultChecklistNumber(id),
          description,
          isActive,
          ...(bumpRevision
            ? {
                latestRevisionNumber: nextLatestRev,
                latestRevisionDate: now,
              }
            : {}),
        },
      })
      if (items.length > 0) {
        await tx.auditChecklistItem.createMany({
          data: items.map((it) => ({
            auditChecklistId: id,
            label: it.label,
            sortOrder: it.sortOrder,
            isRequired: true,
          })),
        })
      }

      if (bumpRevision) {
        await tx.auditChecklistRevision.create({
          data: {
            auditChecklistId: id,
            revisionNumber: nextLatestRev,
            revisionDate: now,
            title: title.slice(0, 400),
            description,
            ...(snapshotItems.length > 0 ? { items: { create: snapshotItems } } : {}),
          },
        })
      } else {
        const revNo = existing.latestRevisionNumber
        const existingRev = await tx.auditChecklistRevision.findUnique({
          where: {
            auditChecklistId_revisionNumber: {
              auditChecklistId: id,
              revisionNumber: revNo,
            },
          },
        })
        if (existingRev) {
          await tx.auditChecklistRevisionItem.deleteMany({
            where: { revisionId: existingRev.id },
          })
          await tx.auditChecklistRevision.update({
            where: { id: existingRev.id },
            data: {
              title: title.slice(0, 400),
              description,
            },
          })
          if (snapshotItems.length > 0) {
            await tx.auditChecklistRevisionItem.createMany({
              data: snapshotItems.map((it) => ({
                revisionId: existingRev.id,
                label: it.label,
                sortOrder: it.sortOrder,
                isRequired: it.isRequired,
              })),
            })
          }
        } else if (snapshotItems.length > 0 || title || description !== undefined) {
          await tx.auditChecklistRevision.create({
            data: {
              auditChecklistId: id,
              revisionNumber: revNo,
              revisionDate: existing.latestRevisionDate ?? now,
              title: title.slice(0, 400),
              description,
              ...(snapshotItems.length > 0 ? { items: { create: snapshotItems } } : {}),
            },
          })
        }
      }
    })

    const updated = await prisma.auditChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error("[audit-checklists PATCH]", e)
    return NextResponse.json(
      { error: "Could not update checklist (number may be in use)." },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  try {
    await prisma.auditChecklist.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

import { NextResponse } from "next/server"
import {
  defaultChecklistNumber,
  parseOptionalDateYmd,
} from "@/lib/audit-checklist-helpers"
import { parseAuditChecklistItemsFromBody } from "@/lib/audit-checklist-items-parse"
import { mapSnapshotItems } from "@/lib/audit-checklist-revision-snapshot"
import { parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import { prisma } from "@/lib/prisma-server"

const DEFAULT_TYPE = "Classic (Satisfactory/Unsatisfactory)"

export async function GET() {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.auditChecklist.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      checklistNumber: true,
      checklistType: true,
      initialRevisionNumber: true,
      initialRevisionDate: true,
      latestRevisionNumber: true,
      latestRevisionDate: true,
      description: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true, assignments: true } },
    },
  })

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
      : DEFAULT_TYPE

  const customNumber =
    typeof b.checklistNumber === "string" && b.checklistNumber.trim()
      ? b.checklistNumber.trim().slice(0, 100)
      : null

  const initialRevRaw = b.initialRevisionNumber
  const initialRev =
    typeof initialRevRaw === "number" && Number.isFinite(initialRevRaw)
      ? Math.trunc(initialRevRaw)
      : typeof initialRevRaw === "string" && initialRevRaw.trim() !== ""
        ? Math.trunc(Number(initialRevRaw))
        : 0

  const initialDate = (() => {
    const v = b.initialRevisionDate
    if (typeof v !== "string" || !v.trim()) return new Date()
    const t = v.trim()
    const fromDdMm = parseDdMmYyyyToUtcDate(t)
    if (fromDdMm) return fromDdMm
    return parseOptionalDateYmd(t) ?? new Date()
  })()

  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim() : null

  const items = parseAuditChecklistItemsFromBody(b.items)

  const maxSort = await prisma.auditChecklist.aggregate({ _max: { sortOrder: true } })
  const nextOrder = (maxSort._max.sortOrder ?? -1) + 1

  try {
    const finalRow = await prisma.$transaction(async (tx) => {
      const created = await tx.auditChecklist.create({
        data: {
          title: title.slice(0, 400),
          checklistType,
          checklistNumber: null,
          initialRevisionNumber: initialRev,
          initialRevisionDate: initialDate,
          latestRevisionNumber: initialRev,
          latestRevisionDate: initialDate,
          description,
          sortOrder: nextOrder,
          isActive: true,
          items: {
            create: items.map((it) => ({
              label: it.label,
              sortOrder: it.sortOrder,
              isRequired: !it.isHeading,
              reference: it.reference,
              section: it.section,
              isHeading: it.isHeading,
            })),
          },
        },
        include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      })

      const num = customNumber ?? defaultChecklistNumber(created.id)

      await tx.auditChecklist.update({
        where: { id: created.id },
        data: { checklistNumber: num },
      })

      const initialSnapshot = mapSnapshotItems(
        created.items.map((it) => ({
          label: it.label,
          sortOrder: it.sortOrder,
          isRequired: it.isRequired,
        }))
      )
      await tx.auditChecklistRevision.create({
        data: {
          auditChecklistId: created.id,
          revisionNumber: initialRev,
          revisionDate: initialDate,
          title: created.title,
          description: created.description,
          ...(initialSnapshot.length > 0
            ? { items: { create: initialSnapshot } }
            : {}),
        },
      })

      return tx.auditChecklist.findUniqueOrThrow({
        where: { id: created.id },
        select: {
          id: true,
          title: true,
          checklistNumber: true,
          checklistType: true,
          initialRevisionNumber: true,
          initialRevisionDate: true,
          latestRevisionNumber: true,
          latestRevisionDate: true,
          description: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { items: true, assignments: true } },
        },
      })
    })

    return NextResponse.json(finalRow, { status: 201 })
  } catch (e) {
    console.error("[audit-checklists POST]", e)
    return NextResponse.json(
      { error: "Could not create checklist (number may be in use)." },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { defaultChecklistNumber } from "@/lib/audit-checklist-helpers"
import { parseAuditChecklistItemsFromBody } from "@/lib/audit-checklist-items-parse"
import { planChecklistItemSync } from "@/lib/audit-checklist-item-sync"
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

  const resolvedChecklistNumber = (() => {
    if (customNumber) return customNumber
    const ex = existing.checklistNumber?.trim()
    if (ex) return ex.slice(0, 100)
    return defaultChecklistNumber(id)
  })()

  const description =
    typeof b.description === "string" && b.description.trim() ? b.description.trim() : null

  const isActive = typeof b.isActive === "boolean" ? b.isActive : existing.isActive

  const bumpRevision = b.bumpRevision !== false

  const items = parseAuditChecklistItemsFromBody(b.items)

  const now = new Date()

  const snapshotItems = mapSnapshotItems(items)

  let protectedDeletionCount = 0

  try {
    await prisma.$transaction(
      async (tx) => {
        // Bu checklist'e ait mevcut item ID'leri — gelen `existingId`'lerin GERÇEKTEN bu
        // checklist'e ait olduğunu doğrulamak için (başka bir checklist'ten sızan/bayat bir id
        // kazara burada bir satırı ele geçirmesin).
        const existingRows = await tx.auditChecklistItem.findMany({
          where: { auditChecklistId: id },
          select: { id: true },
        })
        const existingIdSet = new Set(existingRows.map((r) => r.id))

        // Oturumda (aktif ya da geçmiş, tüm session'lar) kullanılan item ID'leri — bunlar asla
        // silinmez ve içerikleri asla başka bir satırla karışmaz (bkz. aşağıdaki ID bazlı eşleme).
        const usedItemIds = new Set(
          (await tx.auditSessionItem.findMany({
            where: { checklistItem: { auditChecklistId: id } },
            select: { auditChecklistItemId: true },
          })).map((r) => r.auditChecklistItemId)
        )

        // Gelen satırları STABİL ID'ye göre ayır — pozisyon/index'e göre DEĞİL. Kullanılmış
        // (bir denetimde cevaplanmış) ama payload'da karşılığı kalmayan satırlar asla silinmez.
        const { updates, itemsToCreate, idsToDelete, protectedMissingIds } = planChecklistItemSync(
          items,
          existingIdSet,
          usedItemIds
        )
        protectedDeletionCount = protectedMissingIds.length

        if (idsToDelete.length > 0) {
          await tx.auditChecklistItem.deleteMany({ where: { id: { in: idsToDelete } } })
        }

        // Mevcut satırları TEK bir toplu UPDATE ile güncelle (N ayrı round-trip yerine 1) —
        // her satır kendi `id`'sine yazılır, pozisyon hiçbir rol oynamaz.
        if (updates.length > 0) {
          const valueRows = Prisma.join(
            updates.map(
              (u) =>
                Prisma.sql`(${u.existingId}::int, ${u.label.slice(0, 8000)}::text, ${u.sortOrder}::int, ${u.reference}::text, ${u.section}::text, ${!u.isHeading}::boolean, ${u.isHeading}::boolean)`
            ),
            ", "
          )
          await tx.$executeRaw(Prisma.sql`
            UPDATE audit_checklist_items AS t
            SET
              label = v.label,
              sort_order = v.sort_order,
              reference = v.reference,
              section = v.section,
              is_required = v.is_required,
              is_heading = v.is_heading,
              updated_at = now()
            FROM (VALUES ${valueRows}) AS v(id, label, sort_order, reference, section, is_required, is_heading)
            WHERE t.id = v.id AND t.audit_checklist_id = ${id}
          `)
        }

        // Karşılığı olmayan (yeni) satırları oluştur — bunlar her zaman YENİ id alır, mevcut bir
        // satırın id'sini asla devralmaz.
        if (itemsToCreate.length > 0) {
          await tx.auditChecklistItem.createMany({
            data: itemsToCreate.map((it) => ({
              auditChecklistId: id,
              label: it.label,
              sortOrder: it.sortOrder,
              isRequired: !it.isHeading,
              reference: it.reference,
              section: it.section,
              isHeading: it.isHeading,
            })),
          })
        }

        let nextLatestRev: number | null = null
        if (bumpRevision) {
          const agg = await tx.auditChecklistRevision.aggregate({
            where: { auditChecklistId: id },
            _max: { revisionNumber: true },
          })
          const maxStored = agg._max.revisionNumber ?? -1
          nextLatestRev = Math.max(existing.latestRevisionNumber, maxStored) + 1
        }

        await tx.auditChecklist.update({
          where: { id },
          data: {
            title: title.slice(0, 400),
            checklistType,
            checklistNumber: resolvedChecklistNumber,
            description,
            isActive,
            ...(bumpRevision && nextLatestRev !== null
              ? {
                  latestRevisionNumber: nextLatestRev,
                  latestRevisionDate: now,
                }
              : {}),
          },
        })

        if (bumpRevision && nextLatestRev !== null) {
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
                  reference: it.reference,
                  section: it.section,
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
      },
      // Büyük checklist'lerde (80+ madde) bile toplu UPDATE/createMany sayesinde işlem birkaç
      // round-trip'te biter; yine de tek round-trip'lik ağ gecikmesi payı için varsayılan 5s
      // yerine biraz daha geniş bir üst sınır (tek başına "çözüm" değil, asıl iyileştirme
      // yukarıdaki round-trip azaltma — bkz. PR açıklaması).
      { timeout: 15000 }
    )

    const updated = await prisma.auditChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    })

    return NextResponse.json({ ...updated, protectedDeletionCount })
  } catch (e) {
    console.error("[audit-checklists PATCH]", e)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target)
        ? e.meta.target.join(", ")
        : String(e.meta?.target ?? "benzersiz alan")
      return NextResponse.json(
        {
          error: `Bu değer zaten kullanılıyor (${target}). Checklist numarası veya revizyon çakışması olabilir.`,
        },
        { status: 409 }
      )
    }
    const isValidation =
      e instanceof Prisma.PrismaClientValidationError ||
      (typeof e === "object" &&
        e !== null &&
        "name" in e &&
        (e as { name: string }).name === "PrismaClientValidationError")
    if (isValidation) {
      const msg = e instanceof Error ? e.message : String(e)
      const stale =
        msg.includes("Unknown argument") &&
        (msg.includes("reference") || msg.includes("section"))
      return NextResponse.json(
        {
          error: stale
            ? "Prisma istemcisi güncel değil. Terminalde: pnpm exec prisma generate — ardından pnpm dev’i durdurup yeniden başlatın."
            : "Kayıt doğrulanamadı. Alan eşlemesini kontrol edin.",
          ...(process.env.NODE_ENV === "development"
            ? { details: msg.slice(0, 800) }
            : {}),
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: "Checklist güncellenemedi. Sunucu günlüğüne bakın veya destek ile iletişime geçin." },
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

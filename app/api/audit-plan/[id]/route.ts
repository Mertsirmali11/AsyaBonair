import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { defaultChecklistNumber } from "@/lib/audit-checklist-helpers"
import { dbDateToDdMmYyyy, parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { revokeActiveResponseLinksForEntry } from "@/lib/audit-response-link"
import { prisma } from "@/lib/prisma-server"

type Ctx = { params: Promise<{ id: string }> }

function calisanName(c: { isim: string | null; soyisim: string | null }): string {
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || "—"
}

function formatAuditNumber(entry: { id: number; auditNumberPrefix: string | null }): string {
  const p = entry.auditNumberPrefix?.trim()
  return p ? `${p}-${entry.id}` : `AP-${entry.id}`
}

async function requireAuditPlanAccess() {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return null
  }
  return session
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanAccess()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
      auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      auditeeDepartments: { orderBy: { departmentName: "asc" } },
      checklistAssignments: {
        orderBy: { assignedAt: "asc" },
        include: {
          checklist: {
            select: {
              id: true,
              title: true,
              checklistNumber: true,
              checklistType: true,
              latestRevisionNumber: true,
              latestRevisionDate: true,
              _count: { select: { items: true } },
            },
          },
        },
      },
    },
  })

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat
  const auditNumber = formatAuditNumber(entry)

  return NextResponse.json({
    id: String(entry.id),
    title: `${auditNumber} — ${field}`,
    auditNumber,
    field,
    auditCategoryTypeId: entry.auditCategoryTypeId,
    auditSubCategoryTypeId: entry.auditSubCategoryTypeId,
    auditNumberPrefix: entry.auditNumberPrefix,
    categoryName: cat,
    subCategoryName: sub ?? null,
    datePlanned: dbDateToDdMmYyyy(entry.plannedDate),
    datePostponed: entry.datePostponed ? dbDateToDdMmYyyy(entry.datePostponed) : null,
    initializedDate: entry.initializedDate ? dbDateToDdMmYyyy(entry.initializedDate) : null,
    ct: entry.ct,
    remarks: entry.remarks,
    status: entry.status,
    cancellationReason: entry.cancellationReason,
    auditors: entry.auditors.map((a) => ({
      id: a.calisanId,
      name: calisanName(a.calisan),
    })),
    auditees: entry.auditees.map((a) => ({
      id: a.calisanId,
      name: calisanName(a.calisan),
    })),
    auditeeDepartments: entry.auditeeDepartments.map((d) => d.departmentName),
    assignedChecklists: entry.checklistAssignments.map((a) => ({
      assignmentId: a.id,
      checklistId: a.checklist.id,
      title: a.checklist.title,
      checklistNumber:
        a.checklist.checklistNumber ?? defaultChecklistNumber(a.checklist.id),
      checklistType: a.checklist.checklistType,
      revision: String(a.checklist.latestRevisionNumber),
      itemCount: a.checklist._count.items,
      assignedAt: a.assignedAt.toISOString(),
    })),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  })
}

type EntryWithPeople = {
  id: number
  plannedDate: Date
  datePostponed: Date | null
  initializedDate: Date | null
  auditNumberPrefix: string | null
  ct: string
  status: string
  auditCategoryType: { name: string }
  auditSubCategoryType: { name: string } | null
  auditors: {
    calisan: { isim: string | null; soyisim: string | null }
  }[]
  auditees: {
    calisan: { isim: string | null; soyisim: string | null }
  }[]
}

function mapEntry(entry: EntryWithPeople) {
  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat
  return {
    id: String(entry.id),
    datePlanned: dbDateToDdMmYyyy(entry.plannedDate),
    datePostponed: entry.datePostponed ? dbDateToDdMmYyyy(entry.datePostponed) : null,
    initializedDate: entry.initializedDate ? dbDateToDdMmYyyy(entry.initializedDate) : null,
    auditNumber: formatAuditNumber(entry),
    field,
    ct: entry.ct,
    auditors: entry.auditors.map((a) => calisanName(a.calisan)).join(", "),
    status: entry.status,
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireAuditPlanAccess()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const existing = await prisma.auditPlanEntry.findUnique({ where: { id } })
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

  // Status-only update (quick action from table / Manage Audit). "Cancelled" is intentionally
  // excluded here — it requires a mandatory reason and always goes through /cancel.
  if (b.statusOnly === true) {
    const validStatuses = ["Planned", "Initialized", "Postponed", "Completed"]
    const newStatus = typeof b.status === "string" ? b.status : ""
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Postponed Date zorunlu — "Postponed" durumuna geçerken denetlenen tarafın hangi tarihe
    // ertelendiği her zaman kaydedilmeli (bkz. PostponeAuditDialog).
    let postponedDate: Date | null = null
    if (newStatus === "Postponed") {
      const raw = typeof b.datePostponed === "string" ? b.datePostponed.trim() : ""
      postponedDate = raw ? parseDdMmYyyyToUtcDate(raw) : null
      if (!postponedDate) {
        return NextResponse.json({ error: "Postponed Date zorunludur (dd.mm.yyyy)." }, { status: 400 })
      }
    }
    const postponementReason =
      typeof b.postponementReason === "string" ? b.postponementReason.trim() : ""

    try {
      const statusData: Record<string, unknown> = { status: newStatus }
      if (newStatus === "Initialized") statusData.initializedDate = new Date()
      if (newStatus === "Postponed" && postponedDate) statusData.datePostponed = postponedDate
      const updated = await prisma.auditPlanEntry.update({ where: { id }, data: statusData })

      // Completed olduğunda bu denetime bağlı aktif Public Audit Response Link'ler otomatik
      // devre dışı kalır (Reopen bunu geri açmaz — reaktivasyon yetkili kullanıcının açık işlemidir).
      // Ana durum güncellemesini asla etkilememesi için sessizce başarısız olabilir.
      if (newStatus === "Completed" && newStatus !== existing.status) {
        try {
          await revokeActiveResponseLinksForEntry(id)
        } catch {
          // Link iptali başarısız olsa bile durum güncellemesi geçerli kalır
        }
      }

      // Geçmiş / Audit History — durum değişikliği kaydı (Full Report'taki kapanış bilgisi için de kullanılır).
      // Ana durum güncellemesini asla etkilememesi için sessizce başarısız olabilir.
      if (newStatus !== existing.status) {
        try {
          const actorEmail = session.user?.email
          const actor = actorEmail
            ? await prisma.calisan.findFirst({
                where: { email: { equals: actorEmail, mode: "insensitive" } },
                select: { id: true, isim: true, soyisim: true },
              })
            : null
          const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
          const note =
            newStatus === "Postponed" && postponedDate
              ? `Audit postponed to ${dbDateToDdMmYyyy(postponedDate)} by ${actorName}.${postponementReason ? ` Reason: ${postponementReason}` : ""}`
              : null
          await prisma.auditPlanEntryHistory.create({
            data: {
              auditPlanEntryId: id,
              actorId: actor?.id ?? null,
              eventType: "STATUS_CHANGED",
              statusFrom: existing.status,
              statusTo: newStatus,
              note,
            },
          })
        } catch {
          // Geçmiş kaydı başarısız olsa bile durum güncellemesi geçerli kalır
        }
      }

      return NextResponse.json(mapEntry({
        ...updated,
        auditCategoryType: await prisma.auditCategoryType.findUniqueOrThrow({ where: { id: updated.auditCategoryTypeId }, select: { name: true } }),
        auditSubCategoryType: updated.auditSubCategoryTypeId
          ? await prisma.auditSubCategoryType.findUnique({ where: { id: updated.auditSubCategoryTypeId }, select: { name: true } })
          : null,
        auditors: await prisma.auditPlanAuditor.findMany({ where: { auditPlanEntryId: id }, include: { calisan: { select: { isim: true, soyisim: true } } } }),
        auditees: [],
      } as EntryWithPeople))
    } catch (e) {
      console.error("[audit-plan PATCH statusOnly] unexpected error", { id, newStatus }, e)
      return NextResponse.json(
        { error: "Audit could not be completed. Please try again or contact the system administrator." },
        { status: 500 }
      )
    }
  }

  // Initialized Date'in yetkili kullanıcı tarafından manuel olarak belirlenmesi/değiştirilmesi
  // (Manage Audit — General Audit Information). Boş gönderilirse tarih temizlenir.
  if (b.initializedDateOnly === true) {
    const raw = typeof b.initializedDate === "string" ? b.initializedDate.trim() : ""
    const newDate = raw ? parseDdMmYyyyToUtcDate(raw) : null
    if (raw && !newDate) {
      return NextResponse.json({ error: "Invalid initialized date (use dd.mm.yyyy)" }, { status: 400 })
    }

    const oldDateStr = existing.initializedDate ? dbDateToDdMmYyyy(existing.initializedDate) : null
    const newDateStr = newDate ? dbDateToDdMmYyyy(newDate) : null

    const updated = await prisma.auditPlanEntry.update({
      where: { id },
      data: { initializedDate: newDate },
      include: {
        auditCategoryType: { select: { name: true } },
        auditSubCategoryType: { select: { name: true } },
        auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      },
    })

    if (oldDateStr !== newDateStr) {
      try {
        const actorEmail = session.user?.email
        const actor = actorEmail
          ? await prisma.calisan.findFirst({
              where: { email: { equals: actorEmail, mode: "insensitive" } },
              select: { id: true, isim: true, soyisim: true },
            })
          : null
        const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
        await prisma.auditPlanEntryHistory.create({
          data: {
            auditPlanEntryId: id,
            actorId: actor?.id ?? null,
            eventType: "INITIALIZED_DATE_CHANGED",
            statusFrom: oldDateStr,
            statusTo: newDateStr,
            note: `Initialized Date "${oldDateStr ?? "—"}" → "${newDateStr ?? "—"}" olarak ${actorName} tarafından değiştirildi.`,
          },
        })
      } catch {
        // Geçmiş kaydı başarısız olsa bile tarih güncellemesi geçerli kalır
      }
    }

    return NextResponse.json(mapEntry({ ...updated, auditees: [] } as EntryWithPeople))
  }

  // Postponed Date'in yetkili kullanıcı tarafından status değişikliğinden BAĞIMSIZ olarak
  // sonradan değiştirilmesi (Manage Audit — General Audit Information, Initialized Date ile
  // aynı desen). Eski ve yeni tarih history'de ayrı ayrı tutulur.
  if (b.postponedDateOnly === true) {
    const raw = typeof b.datePostponed === "string" ? b.datePostponed.trim() : ""
    const newDate = raw ? parseDdMmYyyyToUtcDate(raw) : null
    if (raw && !newDate) {
      return NextResponse.json({ error: "Invalid postponed date (use dd.mm.yyyy)" }, { status: 400 })
    }

    const oldDateStr = existing.datePostponed ? dbDateToDdMmYyyy(existing.datePostponed) : null
    const newDateStr = newDate ? dbDateToDdMmYyyy(newDate) : null

    const updated = await prisma.auditPlanEntry.update({
      where: { id },
      data: { datePostponed: newDate },
      include: {
        auditCategoryType: { select: { name: true } },
        auditSubCategoryType: { select: { name: true } },
        auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      },
    })

    if (oldDateStr !== newDateStr) {
      try {
        const actorEmail = session.user?.email
        const actor = actorEmail
          ? await prisma.calisan.findFirst({
              where: { email: { equals: actorEmail, mode: "insensitive" } },
              select: { id: true, isim: true, soyisim: true },
            })
          : null
        const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
        await prisma.auditPlanEntryHistory.create({
          data: {
            auditPlanEntryId: id,
            actorId: actor?.id ?? null,
            eventType: "POSTPONED_DATE_CHANGED",
            statusFrom: oldDateStr,
            statusTo: newDateStr,
            note: `Postponed Date "${oldDateStr ?? "—"}" → "${newDateStr ?? "—"}" olarak ${actorName} tarafından değiştirildi.`,
          },
        })
      } catch {
        // Geçmiş kaydı başarısız olsa bile tarih güncellemesi geçerli kalır
      }
    }

    return NextResponse.json(mapEntry({ ...updated, auditees: [] } as EntryWithPeople))
  }

  const plannedDateStr = typeof b.plannedDate === "string" ? b.plannedDate : ""
  const auditNumberPrefix =
    typeof b.auditNumberPrefix === "string" ? b.auditNumberPrefix.trim() : ""
  const remarks = typeof b.remarks === "string" ? b.remarks.trim() : ""

  const auditorIdsRaw = Array.isArray(b.auditorIds) ? b.auditorIds : []
  const auditeeIdsRaw = Array.isArray(b.auditeeIds) ? b.auditeeIds : []
  const auditeeDepartmentsRaw = Array.isArray(b.auditeeDepartments) ? b.auditeeDepartments : []

  const auditorIds = [
    ...new Set(auditorIdsRaw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)),
  ]
  const auditeeIds = [
    ...new Set(auditeeIdsRaw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)),
  ]
  // Denetlenen olarak birey yerine (veya bireylerle birlikte) atanan departman/grup isimleri —
  // mevcut individual auditee seçimini kaldırmaz, ona ek olarak çalışır.
  const auditeeDepartments = [
    ...new Set(
      auditeeDepartmentsRaw
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((s) => s.length > 0)
    ),
  ]

  const auditCategoryTypeId = Number(b.auditCategoryTypeId)
  if (!Number.isInteger(auditCategoryTypeId) || auditCategoryTypeId < 1) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  let auditSubCategoryTypeId: number | undefined
  if (b.auditSubCategoryTypeId !== undefined && b.auditSubCategoryTypeId !== null) {
    const n = Number(b.auditSubCategoryTypeId)
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "Invalid sub-category" }, { status: 400 })
    }
    auditSubCategoryTypeId = n
  }

  const planned = parseDdMmYyyyToUtcDate(plannedDateStr)
  if (!planned) {
    return NextResponse.json({ error: "Invalid planned date (use dd.mm.yyyy)" }, { status: 400 })
  }

  const categoryType = await prisma.auditCategoryType.findFirst({
    where: { id: auditCategoryTypeId, isActive: true },
    select: { id: true },
  })
  if (!categoryType) {
    return NextResponse.json({ error: "Unknown or inactive category" }, { status: 400 })
  }

  const activeSubCount = await prisma.auditSubCategoryType.count({
    where: { auditCategoryTypeId, isActive: true },
  })
  if (activeSubCount > 0) {
    if (auditSubCategoryTypeId === undefined) {
      return NextResponse.json({ error: "Sub-category is required" }, { status: 400 })
    }
    const subRow = await prisma.auditSubCategoryType.findFirst({
      where: {
        id: auditSubCategoryTypeId,
        auditCategoryTypeId,
        isActive: true,
      },
      select: { id: true },
    })
    if (!subRow) {
      return NextResponse.json({ error: "Invalid sub-category for this category" }, { status: 400 })
    }
  } else {
    auditSubCategoryTypeId = undefined
  }

  const existingAuditors =
    auditorIds.length > 0
      ? await prisma.calisan.findMany({
          where: { id: { in: auditorIds } },
          select: { id: true },
        })
      : []
  const existingAuditees =
    auditeeIds.length > 0
      ? await prisma.calisan.findMany({
          where: { id: { in: auditeeIds } },
          select: { id: true },
        })
      : []

  const auditorOk = new Set(existingAuditors.map((c) => c.id))
  const auditeeOk = new Set(existingAuditees.map((c) => c.id))
  const auditorCreate = auditorIds.filter((cid) => auditorOk.has(cid)).map((calisanId) => ({ calisanId }))
  const auditeeCreate = auditeeIds.filter((cid) => auditeeOk.has(cid)).map((calisanId) => ({ calisanId }))

  const priorDepartments = (
    await prisma.auditPlanAuditeeDepartment.findMany({
      where: { auditPlanEntryId: id },
      select: { departmentName: true },
    })
  ).map((d) => d.departmentName).sort()

  try {
    const updated = await prisma.auditPlanEntry.update({
      where: { id },
      data: {
        plannedDate: planned,
        auditCategoryTypeId,
        auditSubCategoryTypeId: auditSubCategoryTypeId ?? null,
        auditNumberPrefix: auditNumberPrefix || null,
        remarks: remarks || null,
        auditors: {
          deleteMany: {},
          create: auditorCreate,
        },
        auditees: {
          deleteMany: {},
          create: auditeeCreate,
        },
        auditeeDepartments: {
          deleteMany: {},
          create: auditeeDepartments.map((departmentName) => ({ departmentName })),
        },
      },
      include: {
        auditCategoryType: { select: { name: true } },
        auditSubCategoryType: { select: { name: true } },
        auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
        auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      },
    })

    // Geçmiş / Audit History — Planned Date değişikliği (Manage Audit'in General Info
    // düzenlemesinden gelir). Ana güncellemeyi asla etkilemeyecek şekilde sessizce başarısız olabilir.
    if (existing.plannedDate.getTime() !== planned.getTime()) {
      try {
        const actorEmail = session.user?.email
        const actor = actorEmail
          ? await prisma.calisan.findFirst({
              where: { email: { equals: actorEmail, mode: "insensitive" } },
              select: { id: true, isim: true, soyisim: true },
            })
          : null
        const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
        const oldStr = dbDateToDdMmYyyy(existing.plannedDate)
        const newStr = dbDateToDdMmYyyy(planned)
        await prisma.auditPlanEntryHistory.create({
          data: {
            auditPlanEntryId: id,
            actorId: actor?.id ?? null,
            eventType: "PLANNED_DATE_CHANGED",
            statusFrom: oldStr,
            statusTo: newStr,
            note: `Planned Date "${oldStr}" → "${newStr}" olarak ${actorName} tarafından değiştirildi.`,
          },
        })
      } catch {
        // Geçmiş kaydı başarısız olsa bile güncelleme geçerli kalır
      }
    }

    // Geçmiş / Audit History — Auditee Group/Department ataması değişikliği.
    const sortedNewDepartments = [...auditeeDepartments].sort()
    if (JSON.stringify(priorDepartments) !== JSON.stringify(sortedNewDepartments)) {
      try {
        const actorEmail = session.user?.email
        const actor = actorEmail
          ? await prisma.calisan.findFirst({
              where: { email: { equals: actorEmail, mode: "insensitive" } },
              select: { id: true, isim: true, soyisim: true },
            })
          : null
        const actorName = actor ? [actor.isim, actor.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı" : "Bilinmeyen kullanıcı"
        await prisma.auditPlanEntryHistory.create({
          data: {
            auditPlanEntryId: id,
            actorId: actor?.id ?? null,
            eventType: "AUDITEE_DEPARTMENT_CHANGED",
            note: `Auditee Group: ${sortedNewDepartments.length > 0 ? sortedNewDepartments.join(", ") : "—"} olarak ${actorName} tarafından güncellendi.`,
          },
        })
      } catch {
        // Geçmiş kaydı başarısız olsa bile güncelleme geçerli kalır
      }
    }

    return NextResponse.json(mapEntry(updated as EntryWithPeople))
  } catch (e) {
    console.error("[audit-plan PATCH]", e)
    return NextResponse.json({ error: "Could not update audit." }, { status: 500 })
  }
}

/**
 * Denetim kaydını siler — ancak yalnızca "yanlışlıkla oluşturulmuş, henüz işlem
 * yapılmamış" kayıtlar için gerçek (hard) silme yapılır. Checklist cevapları, bulgu,
 * dosya veya denetlenen yanıtı gibi gerçek veri içeren kayıtlarda kontrolsüz hard-delete
 * YAPILMAZ — sistemin zaten var olan "Cancelled" durumu bu modülün archive mekanizması
 * olduğundan kullanıcı oraya yönlendirilir (yeni bir paralel soft-delete alanı icat
 * edilmez). Completed denetimler hiçbir koşulda silinemez.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireAuditPlanAccess()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const entry = await prisma.auditPlanEntry.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      _count: {
        select: {
          sessions: true,
          documents: true,
          responseNotes: true,
          responseLinks: true,
        },
      },
    },
  })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (entry.status === "Completed") {
    return NextResponse.json(
      { error: "Completed audits cannot be deleted. Please cancel/archive instead." },
      { status: 409 }
    )
  }

  const findingsCount = await prisma.auditFinding.count({
    where: { deletedAt: null, OR: [{ auditPlanEntryId: id }, { session: { auditPlanEntryId: id } }] },
  })

  const hasData =
    entry._count.sessions > 0 ||
    findingsCount > 0 ||
    entry._count.documents > 0 ||
    entry._count.responseNotes > 0 ||
    entry._count.responseLinks > 0

  if (hasData) {
    return NextResponse.json(
      {
        error:
          "Bu denetimde checklist cevapları, bulgular, dosyalar veya denetlenen yanıtları bulunduğu için silinemez. Bunun yerine denetimi İptal Et (Cancelled) ile arşivleyin.",
      },
      { status: 409 }
    )
  }

  try {
    await prisma.auditPlanEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}

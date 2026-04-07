import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { dbDateToDdMmYyyy, parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { prisma } from "@/lib/prisma-server"

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

function calisanName(c: { isim: string | null; soyisim: string | null }): string {
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || "—"
}

function formatAuditNumber(entry: { id: number; auditNumberPrefix: string | null }): string {
  const p = entry.auditNumberPrefix?.trim()
  return p ? `${p}-${entry.id}` : `AP-${entry.id}`
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

async function requireAuditPlanAccess() {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireAuditPlanAccess()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const entries = await prisma.auditPlanEntry.findMany({
    orderBy: { plannedDate: "desc" },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
      auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
    },
  })

  return NextResponse.json(entries.map(mapEntry))
}

export async function POST(req: Request) {
  const session = await requireAuditPlanAccess()
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
  const plannedDateStr = typeof b.plannedDate === "string" ? b.plannedDate : ""
  const auditNumberPrefix =
    typeof b.auditNumberPrefix === "string" ? b.auditNumberPrefix.trim() : ""
  const remarks = typeof b.remarks === "string" ? b.remarks.trim() : ""

  const auditorIdsRaw = Array.isArray(b.auditorIds) ? b.auditorIds : []
  const auditeeIdsRaw = Array.isArray(b.auditeeIds) ? b.auditeeIds : []

  const auditorIds = [...new Set(auditorIdsRaw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))]
  const auditeeIds = [...new Set(auditeeIdsRaw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))]

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
  const auditorCreate = auditorIds.filter((id) => auditorOk.has(id)).map((calisanId) => ({ calisanId }))
  const auditeeCreate = auditeeIds.filter((id) => auditeeOk.has(id)).map((calisanId) => ({ calisanId }))

  const created = await prisma.auditPlanEntry.create({
    data: {
      plannedDate: planned,
      auditCategoryTypeId,
      auditSubCategoryTypeId: auditSubCategoryTypeId ?? null,
      auditNumberPrefix: auditNumberPrefix || null,
      remarks: remarks || null,
      status: "Initialized",
      auditors: { create: auditorCreate },
      auditees: { create: auditeeCreate },
    },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
      auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
    },
  })

  return NextResponse.json(mapEntry(created as EntryWithPeople), { status: 201 })
}

import { NextResponse } from "next/server"
import { requireAuditPlanSession } from "@/lib/audit-plan-session"
import {
  AUDIT_PLAN_ENTRY_TYPE_CONFIG,
  isAuditPlanEntryType,
  type AuditPlanEntryType,
} from "@/lib/audit-plan-type"
import { dbDateToDdMmYyyy, parseDdMmYyyyToUtcDate } from "@/lib/correspondence-date"
import { prisma } from "@/lib/prisma-server"
import {
  AUDIT_PLAN_ENTRY_FINDINGS_INCLUDE,
  formatFindingsCT,
} from "@/lib/audit-plan-findings-count"

type EntryWithPeople = {
  id: number
  auditType: string
  plannedDate: Date
  datePostponed: Date | null
  initializedDate: Date | null
  auditNumberPrefix: string | null
  status: string
  auditCategoryType: { name: string }
  auditSubCategoryType: { name: string } | null
  auditingBodyType: { name: string } | null
  auditors: {
    calisan: { isim: string | null; soyisim: string | null }
  }[]
  auditees: {
    calisan: { isim: string | null; soyisim: string | null }
  }[]
  manualFindings: { id: number; status: string }[]
  sessions: { findings: { id: number; status: string }[] }[]
}

function calisanName(c: { isim: string | null; soyisim: string | null }): string {
  const n = [c.isim, c.soyisim].filter(Boolean).join(" ").trim()
  return n || "—"
}

/** Kullanıcı boş bırakırsa Audit Number'da kullanılan önek — auditType'a göre değişir
 * (AP-/UA-/IA-), böylece Unplanned/Incoming kayıtları "Audit Plan"ı çağrıştırmaz. */
function formatAuditNumber(entry: { id: number; auditNumberPrefix: string | null; auditType: string }): string {
  const p = entry.auditNumberPrefix?.trim()
  const fallback = isAuditPlanEntryType(entry.auditType)
    ? AUDIT_PLAN_ENTRY_TYPE_CONFIG[entry.auditType].defaultAuditNumberPrefix
    : "AP"
  return p ? `${p}-${entry.id}` : `${fallback}-${entry.id}`
}

function mapEntry(entry: EntryWithPeople) {
  const cat = entry.auditCategoryType.name
  const sub = entry.auditSubCategoryType?.name
  const field = sub ? `${cat} — ${sub}` : cat
  return {
    id: String(entry.id),
    auditType: entry.auditType,
    datePlanned: dbDateToDdMmYyyy(entry.plannedDate),
    datePostponed: entry.datePostponed ? dbDateToDdMmYyyy(entry.datePostponed) : null,
    initializedDate: entry.initializedDate ? dbDateToDdMmYyyy(entry.initializedDate) : null,
    auditNumber: formatAuditNumber(entry),
    field,
    ct: formatFindingsCT(entry),
    auditors: entry.auditors.map((a) => calisanName(a.calisan)).join(", "),
    auditingBodyName: entry.auditingBodyType?.name ?? null,
    status: entry.status,
  }
}

function prismaConnectErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/timeout exceeded|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(msg)) {
    return "Veritabanına bağlanılamadı (zaman aşımı veya ağ). PostgreSQL/Supabase çalışıyor mu ve DATABASE_URL doğru mu kontrol edin."
  }
  return "Veritabanı hatası. Bir süre sonra tekrar deneyin."
}

export async function GET(req: Request) {
  const session = await requireAuditPlanSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // `type` verilmezse PLANNED — bugünkü /compliance/audit-plan ekranının davranışı birebir
  // korunur (geriye dönük uyumlu varsayılan). Unplanned/Incoming Audits sayfaları ?type=... ile
  // AYNI bu route'u çağırır, ayrı bir API ağacı yoktur.
  const url = new URL(req.url)
  const typeParam = url.searchParams.get("type")
  const auditType: AuditPlanEntryType = isAuditPlanEntryType(typeParam) ? typeParam : "PLANNED"

  try {
    const entries = await prisma.auditPlanEntry.findMany({
      where: { auditType },
      orderBy: { plannedDate: "desc" },
      include: {
        auditCategoryType: { select: { name: true } },
        auditSubCategoryType: { select: { name: true } },
        auditingBodyType: { select: { name: true } },
        auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
        auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
        ...AUDIT_PLAN_ENTRY_FINDINGS_INCLUDE,
      },
    })
    return NextResponse.json(entries.map(mapEntry))
  } catch (e) {
    console.error("[GET /api/audit-plan]", e)
    return NextResponse.json({ error: prismaConnectErrorMessage(e) }, { status: 503 })
  }
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
  // auditType yalnızca CREATE'te kabul edilir (yoksa PLANNED — bugünkü davranış korunur);
  // gönderilirse geçerli bir değer olmalı, aksi halde 400 (sessizce PLANNED'a düşürmek yanlış
  // türde kayıt oluşturur). Var olan bir kaydın türü bu route'tan (PATCH) DEĞİŞTİRİLEMEZ.
  let auditType: AuditPlanEntryType = "PLANNED"
  if (b.auditType !== undefined) {
    if (!isAuditPlanEntryType(b.auditType)) {
      return NextResponse.json({ error: "Invalid auditType" }, { status: 400 })
    }
    auditType = b.auditType
  }
  const plannedDateStr = typeof b.plannedDate === "string" ? b.plannedDate : ""
  const auditNumberPrefix =
    typeof b.auditNumberPrefix === "string" ? b.auditNumberPrefix.trim() : ""
  const remarks = typeof b.remarks === "string" ? b.remarks.trim() : ""

  // Yalnızca INCOMING denetimlerde anlamlı — diğer türlerde undefined/null gönderilirse null kalır.
  let auditingBodyTypeId: number | null = null
  if (b.auditingBodyTypeId !== undefined && b.auditingBodyTypeId !== null) {
    const n = Number(b.auditingBodyTypeId)
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "Invalid auditingBodyTypeId" }, { status: 400 })
    }
    auditingBodyTypeId = n
  }

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

  if (auditingBodyTypeId !== null) {
    const bodyType = await prisma.auditingBodyType.findFirst({
      where: { id: auditingBodyTypeId, isActive: true },
      select: { id: true },
    })
    if (!bodyType) {
      return NextResponse.json({ error: "Unknown or inactive auditing body" }, { status: 400 })
    }
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
      auditType,
      plannedDate: planned,
      auditCategoryTypeId,
      auditSubCategoryTypeId: auditSubCategoryTypeId ?? null,
      auditNumberPrefix: auditNumberPrefix || null,
      auditingBodyTypeId,
      remarks: remarks || null,
      status: "Planned",
      auditors: { create: auditorCreate },
      auditees: { create: auditeeCreate },
    },
    include: {
      auditCategoryType: { select: { name: true } },
      auditSubCategoryType: { select: { name: true } },
        auditingBodyType: { select: { name: true } },
      auditors: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      auditees: { include: { calisan: { select: { isim: true, soyisim: true } } } },
      ...AUDIT_PLAN_ENTRY_FINDINGS_INCLUDE,
    },
  })

  return NextResponse.json(mapEntry(created as EntryWithPeople), { status: 201 })
}

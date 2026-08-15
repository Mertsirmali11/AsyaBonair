import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma-server"

export type SacaAuditRow = {
  id: number
  plannedDate: string
  status: string
  auditNumber: string
  /** SACA kategorisi altındaki alt kategori adı — genelde uçak tescili (ör. TC-AHL SACA) */
  aircraft: string
  cat1Count: number
  cat2Count: number
  cat3Count: number
}

function formatAuditNumber(entry: { id: number; auditNumberPrefix: string | null }): string {
  const p = entry.auditNumberPrefix?.trim()
  return p ? `${p}-${entry.id}` : `AP-${entry.id}`
}

export type SacaAuditFilters = {
  from?: string | null
  to?: string | null
  aircraft?: string | null
}

/**
 * Denetim Planı'ndaki "SACA" kategorili tüm kayıtları, bulgularını Cat1/Cat2/Cat3'e
 * eşleyerek döner.
 *
 * ROOT-CAUSE FIX (2026-08-15): Bulgular önceden yalnızca `AuditSession.findings` üzerinden
 * okunuyordu — bu ilişki yalnızca checklist'te bir madde "U" işaretlenince OTOMATİK oluşan
 * bulguları kapsar (auditSessionId dolu). Ama "Add Finding" ile MANUEL eklenen bulgularda
 * (auditPlanEntryId doğrudan dolu, auditSessionId null) bu ilişki hiç dolmuyordu — production'da
 * TÜM SACA bulguları (29/29) bu manuel yoldan girildiği için dashboard'da Cat1/2/3 hep 0
 * görünüyordu. Şimdi AuditFinding doğrudan, iki yolu da (auditPlanEntryId VEYA
 * session.auditPlanEntryId) kapsayan OR-where ile sorgulanıyor — aynı desen
 * app/api/audit-findings/route.ts ve app/api/audit-plan/[id]/findings/route.ts GET'te zaten
 * kullanılıyor. Bu iki yol bir finding'de KARŞILIKLI DIŞLAYICI (asla ikisi birden dolu olmaz),
 * bu yüzden tek geçişte gruplamak duplicate sayım riski taşımaz. Soft-delete edilmiş
 * (deletedAt dolu) bulgular hariç tutulur. Kategori kaynağı yalnızca `findingCategory` —
 * eski `findingLevel` alanına hiç bakılmaz (SACA/SAFA'da zaten hep null).
 */
export async function fetchSacaAuditRows(filters?: SacaAuditFilters): Promise<SacaAuditRow[]> {
  const where: Prisma.AuditPlanEntryWhereInput = {
    auditCategoryType: { name: { equals: "SACA", mode: "insensitive" } },
  }

  if (filters?.from || filters?.to) {
    where.plannedDate = {}
    if (filters.from) {
      const d = new Date(filters.from)
      if (!Number.isNaN(d.getTime())) where.plannedDate.gte = d
    }
    if (filters.to) {
      const d = new Date(filters.to)
      if (!Number.isNaN(d.getTime())) where.plannedDate.lte = d
    }
  }
  if (filters?.aircraft?.trim()) {
    where.auditSubCategoryType = {
      name: { contains: filters.aircraft.trim(), mode: "insensitive" },
    }
  }

  const entries = await prisma.auditPlanEntry.findMany({
    where,
    orderBy: { plannedDate: "asc" },
    select: {
      id: true,
      plannedDate: true,
      status: true,
      auditNumberPrefix: true,
      auditSubCategoryType: { select: { name: true } },
    },
  })

  if (entries.length === 0) return []

  const entryIds = entries.map((e) => e.id)

  // Bu denetimlere ait TÜM bulgular — checklist üzerinden otomatik oluşanlar (session üzerinden)
  // VE "Add Finding" ile manuel eklenenler (auditPlanEntryId doğrudan). Soft-delete hariç.
  const findings = await prisma.auditFinding.findMany({
    where: {
      deletedAt: null,
      OR: [
        { auditPlanEntryId: { in: entryIds } },
        { session: { auditPlanEntryId: { in: entryIds } } },
      ],
    },
    select: {
      findingCategory: true,
      auditPlanEntryId: true,
      session: { select: { auditPlanEntryId: true } },
    },
  })

  const catByEntry = new Map<number, { cat1: number; cat2: number; cat3: number }>()
  for (const f of findings) {
    // auditPlanEntryId ve session.auditPlanEntryId aynı finding'de asla birlikte dolu olmaz
    // (bkz. yorum üstte) — bu yüzden "ilkini bul, yoksa ikincisini kullan" güvenli, duplicate
    // riski taşımaz.
    const effectiveEntryId = f.auditPlanEntryId ?? f.session?.auditPlanEntryId ?? null
    if (effectiveEntryId === null) continue
    const bucket = catByEntry.get(effectiveEntryId) ?? { cat1: 0, cat2: 0, cat3: 0 }
    if (f.findingCategory === "CAT1") bucket.cat1 += 1
    else if (f.findingCategory === "CAT2") bucket.cat2 += 1
    else if (f.findingCategory === "CAT3") bucket.cat3 += 1
    catByEntry.set(effectiveEntryId, bucket)
  }

  return entries.map((entry) => {
    const c = catByEntry.get(entry.id) ?? { cat1: 0, cat2: 0, cat3: 0 }
    return {
      id: entry.id,
      plannedDate: entry.plannedDate.toISOString(),
      status: entry.status,
      auditNumber: formatAuditNumber(entry),
      aircraft: entry.auditSubCategoryType?.name ?? "—",
      cat1Count: c.cat1,
      cat2Count: c.cat2,
      cat3Count: c.cat3,
    }
  })
}

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
 * Denetim Planı'ndaki "SACA" kategorili tüm kayıtları, oturumlarındaki
 * bulguları Cat1/Cat2/Cat3'e eşleyerek döner. Bulgular tamamen Denetim Planı
 * → Audit Session akışından gelir; burada ayrıca manuel veri girişi yoktur.
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
      sessions: {
        select: {
          findings: { select: { findingCategory: true } },
        },
      },
    },
  })

  return entries.map((entry) => {
    let cat1Count = 0
    let cat2Count = 0
    let cat3Count = 0
    for (const session of entry.sessions) {
      for (const finding of session.findings) {
        // SACA denetimlerinde tek sınıflandırma artık findingCategory (CAT1/2/3) — eskiden
        // findingLevel'dan türetiliyordu (bkz. lib/saca-ratio.ts: findingLevelToSacaCategory,
        // hâlâ eski/tarihsel referans için mevcut ama artık burada kullanılmıyor). Eski
        // kayıtlar migration ile (20260813180000_saca_safa_finding_category_only) aynı
        // eşlemeyle geriye dönük dolduruldu, bu yüzden skor geçmişe dönük değişmedi.
        if (finding.findingCategory === "CAT1") cat1Count += 1
        else if (finding.findingCategory === "CAT2") cat2Count += 1
        else if (finding.findingCategory === "CAT3") cat3Count += 1
      }
    }
    return {
      id: entry.id,
      plannedDate: entry.plannedDate.toISOString(),
      status: entry.status,
      auditNumber: formatAuditNumber(entry),
      aircraft: entry.auditSubCategoryType?.name ?? "—",
      cat1Count,
      cat2Count,
      cat3Count,
    }
  })
}

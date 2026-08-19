/**
 * Audit Plan tablosundaki "C / T" (Closed / Total) kolonu — bir denetime ait
 * bulguların (AuditFinding) toplam ve kapanmış sayısı.
 *
 * İki ayrı ilişki üzerinden bulgu oluşabiliyor (prisma/schema.prisma AuditFinding):
 *  - Manuel: AuditFinding.auditPlanEntryId doğrudan AuditPlanEntry'ye bağlı
 *    ("Denetim Planı 'Bulgu Ekle'").
 *  - Checklist/session: AuditFinding.auditSessionId -> AuditSession.auditPlanEntryId
 *    (checklist üzerinden Unsatisfactory sonucuyla otomatik oluşan bulgular).
 * Şemadaki yorumlara göre bu iki alan karşılıklı dışlayıcıdır (bir finding ya
 * manuel ya session kaynaklıdır, asla ikisi birden), yani yapısal olarak
 * duplicate oluşmaz — yine de id üzerinden tekilleştirme burada savunma amaçlı
 * uygulanır.
 *
 * `status` "Open" | "Closed" (bkz. AuditFinding.status default + yorum) — source
 * of truth budur, string tahmini/case-insensitive karşılaştırma yapılmaz.
 * Soft-delete edilmiş (`deletedAt != null`) bulgular her iki include dalında da
 * `where: { deletedAt: null }` ile zaten hariç tutulur.
 */

export const CLOSED_FINDING_STATUS = "Closed"

/**
 * Prisma `include` parçası — AuditPlanEntry sorgusuna eklenince, listedeki HER
 * satır için ayrı sorgu atmadan (N+1 yok, Prisma tek batched query ile getirir)
 * "C / T" hesaplamak için gereken minimum alanları taşır.
 */
export const AUDIT_PLAN_ENTRY_FINDINGS_INCLUDE = {
  manualFindings: {
    where: { deletedAt: null },
    select: { id: true, status: true },
  },
  sessions: {
    select: {
      findings: {
        where: { deletedAt: null },
        select: { id: true, status: true },
      },
    },
  },
} as const

type FindingsShape = {
  manualFindings: { id: number; status: string }[]
  sessions: { findings: { id: number; status: string }[] }[]
}

/** "Closed / Total" — manuel + session/checklist bulgularını birleştirir, finding id üzerinden tekilleştirir. */
export function formatFindingsCT(entry: FindingsShape): string {
  const all = [
    ...entry.manualFindings,
    ...entry.sessions.flatMap((s) => s.findings),
  ]
  const seen = new Set<number>()
  let total = 0
  let closed = 0
  for (const f of all) {
    if (seen.has(f.id)) continue
    seen.add(f.id)
    total += 1
    if (f.status === CLOSED_FINDING_STATUS) closed += 1
  }
  return `${closed} / ${total}`
}

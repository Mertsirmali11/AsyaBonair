import { departmentNamesMatch } from "@/lib/department-name-match"

/**
 * Finding visibility'nin SAF (DB'siz) kısmı — "bu finding, şu scope'taki kullanıcı tarafından
 * görülebilir mi?" sorusunun mantığı. Bilerek prisma/"server-only" bağımlılığı YOK, DB'ye
 * dokunmadan izole test edilebilmesi için (bkz.
 * scripts/verify-finding-visibility-scope.ts). DB'ye bağımlı kısım (scope'u session'dan
 * çözmek) lib/audit-finding-visibility.ts'te, bu saf fonksiyonları kullanır.
 */
export type FindingVisibilityScope =
  | { kind: "all" }
  | {
      kind: "limited"
      calisanId: number | null
      departman: string | null | undefined
      /** Soft-delete edilmemiş (aktif) gruplardaki üyelikler. */
      activeGroupIds: number[]
    }

/** Bir finding'in scope karşılaştırması için ihtiyaç duyulan minimal alanlar. */
export type FindingScopeCandidate = {
  assignedToId: number | null
  assignedGroupId: number | null
  entryAuditeeDepartments: string[]
  entryAuditorCalisanIds: number[]
  /** Denetime BİREYSEL auditee/responsible person olarak eklenmiş kişiler (AuditPlanAuditee) —
   * departmanları farklı olsa bile kriter 5'i sağlarlar. */
  entryAuditeeCalisanIds: number[]
}

/** `session.entry` / `manualEntry` include'undan `FindingScopeCandidate` çıkarır — LIST ve
 * TEK bulgu sorgusu farklı select şekilleri kullanabilir, ikisi de bu şekle indirgenmeli. */
export function extractFindingScopeCandidate(finding: {
  assignedToId: number | null
  assignedGroupId: number | null
  session: {
    entry: {
      auditeeDepartments: { departmentName: string }[]
      auditors: { calisanId: number }[]
      auditees: { calisanId: number }[]
    } | null
  } | null
  manualEntry: {
    auditeeDepartments: { departmentName: string }[]
    auditors: { calisanId: number }[]
    auditees: { calisanId: number }[]
  } | null
}): FindingScopeCandidate {
  const entry = finding.session?.entry ?? finding.manualEntry ?? null
  return {
    assignedToId: finding.assignedToId,
    assignedGroupId: finding.assignedGroupId,
    entryAuditeeDepartments: entry?.auditeeDepartments.map((d) => d.departmentName) ?? [],
    entryAuditorCalisanIds: entry?.auditors.map((a) => a.calisanId) ?? [],
    entryAuditeeCalisanIds: entry?.auditees.map((a) => a.calisanId) ?? [],
  }
}

/**
 * `scope.kind === "limited"` iken tek bir finding görülebilir mi? Beşi de OR, "yalnızca" bu
 * beşi: (1) assignedToId kendisiyle eşleşiyor mu, (2) assignedGroupId üyesi olduğu aktif bir
 * grup mu, (3) denetimin auditee department'larından biri kendi departmanıyla eşleşiyor mu,
 * (4) denetimin auditor'larından biri kendisi mi, (5) denetime BİREYSEL auditee/responsible
 * person olarak (departmanından bağımsız) eklenmiş mi.
 */
export function findingMatchesLimitedScope(
  finding: FindingScopeCandidate,
  scope: Extract<FindingVisibilityScope, { kind: "limited" }>
): boolean {
  if (scope.calisanId != null && finding.assignedToId === scope.calisanId) return true
  if (finding.assignedGroupId != null && scope.activeGroupIds.includes(finding.assignedGroupId)) return true
  if (finding.entryAuditeeDepartments.some((d) => departmentNamesMatch(d, scope.departman))) return true
  if (scope.calisanId != null && finding.entryAuditorCalisanIds.includes(scope.calisanId)) return true
  if (scope.calisanId != null && finding.entryAuditeeCalisanIds.includes(scope.calisanId)) return true
  return false
}

/** Prisma include/select fragment'i — LIST ve TEK bulgu sorgusu bunu paylaşır. */
export const FINDING_SCOPE_ENTRY_SELECT = {
  auditeeDepartments: { select: { departmentName: true } },
  auditors: { select: { calisanId: true } },
  auditees: { select: { calisanId: true } },
} as const

import "server-only"

import { isFullFindingVisibilityDepartment } from "@/lib/department-access"
import { prisma } from "@/lib/prisma-server"

export {
  FINDING_SCOPE_ENTRY_SELECT,
  extractFindingScopeCandidate,
  findingMatchesLimitedScope,
  type FindingScopeCandidate,
  type FindingVisibilityScope,
} from "@/lib/audit-finding-visibility-scope"

/**
 * Finding visibility'nin TEK kaynağı — hem LIST (GET /api/audit-findings) hem TEK bulgu
 * erişimi (lib/audit-finding-auditee-access.ts) BU dosyayı kullanır, paralel mantık yoktur.
 *
 * "Tüm findings" (`kind: "all"`) YALNIZCA gerçek departman Admin veya Compliance Monitoring
 * Department olduğunda verilir — `COMPLIANCE_MONITORING` department permission'ının (modül
 * erişimi için) başka bir departmana açık olması BUNU vermez, bkz.
 * lib/department-access.ts isFullFindingVisibilityDepartment.
 *
 * Diğer herkes (`kind: "limited"`) yalnızca: (1) assignedToId kendisiyle eşleşen, (2) kendi
 * departmanına (entry.auditeeDepartments) atanmış, (3) üyesi olduğu AKTİF bir User Group'a
 * (assignedGroupId) atanmış, (4) auditor olduğu denetime (entry.auditors) ait bulguları görür
 * — bkz. lib/audit-finding-visibility-scope.ts findingMatchesLimitedScope (DB'siz, izole test
 * edilebilir saf mantık).
 *
 * Bilerek CPA YAZMA/REVIEW yetkisiyle karıştırılmaz — bu dosya yalnızca "görebilir mi" sorusuna
 * cevap verir. CPA cevabı gönderme hâlâ SADECE requireCpaResponsiblePerson
 * (lib/audit-finding-cpa-access.ts) ile, review hâlâ SADECE requireCpaReviewer ile kontrol
 * edilir — "tüm findings" görünürlüğü bu ikisini ASLA bypass etmez.
 */
export async function resolveFindingVisibilityScope(
  userEmail: string | null | undefined,
  userDepartman: string | null | undefined
): Promise<import("@/lib/audit-finding-visibility-scope").FindingVisibilityScope> {
  if (isFullFindingVisibilityDepartment(userDepartman)) {
    return { kind: "all" }
  }

  if (!userEmail?.trim()) {
    return { kind: "limited", calisanId: null, departman: userDepartman, activeGroupIds: [] }
  }

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: userEmail, mode: "insensitive" } },
    select: { id: true },
  })
  const calisanId = calisan?.id ?? null

  const activeGroupIds = calisanId
    ? (
        await prisma.userGroupMember.findMany({
          where: { calisanId, group: { deletedAt: null } },
          select: { groupId: true },
        })
      ).map((m) => m.groupId)
    : []

  return { kind: "limited", calisanId, departman: userDepartman, activeGroupIds }
}

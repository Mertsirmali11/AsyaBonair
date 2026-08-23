import {
  FINDING_SCOPE_ENTRY_SELECT,
  extractFindingScopeCandidate,
  findingMatchesLimitedScope,
  resolveFindingVisibilityScope,
} from "@/lib/audit-finding-visibility"
import { prisma } from "@/lib/prisma-server"

export type FindingAuditeeAccess = {
  isAdmin: boolean
  /** own department / atandığı grup / auditor olduğu denetim eşleşmesi — bkz. lib/audit-finding-visibility.ts. */
  isAuditee: boolean
  calisanId: number | null
}

/**
 * Bir bulguya READ erişimini (görüntüleme, dosya/geçmiş/CPA cevap listesi) çözer — TEK yetki
 * kaynağı lib/audit-finding-visibility.ts'teki `resolveFindingVisibilityScope` /
 * `findingMatchesLimitedScope`'tur, burada paralel bir mantık YOKTUR.
 *
 * `isAdmin: true` yalnızca gerçek departmanı Admin veya Compliance Monitoring Department olan
 * kullanıcılarda döner (bkz. lib/department-access.ts isFullFindingVisibilityDepartment) —
 * `compliance_monitoring` department permission'ının başka bir departmana açık olması bunu
 * TEK BAŞINA vermez. Admin değilse: kendine assignedTo, kendi departmanına atanmış, üyesi
 * olduğu aktif bir gruba atanmış, auditor olduğu denetime ait veya denetime bireysel
 * auditee/responsible person olarak (departmanından bağımsız) atanmış bulgular görülebilir.
 *
 * DİKKAT: bu fonksiyon SADECE görünürlük/okuma sorusuna cevap verir. CPA cevabı gönderme
 * (requireCpaResponsiblePerson) ve CPA review (requireCpaReviewer) BUNU kullanmaz — admin/
 * "tüm findings" görünürlüğü CPA yazma yetkisi vermez (bkz. lib/audit-finding-cpa-access.ts).
 */
export async function resolveFindingAuditeeAccess(
  findingId: number,
  userEmail: string | null | undefined,
  userDepartman: string | null | undefined
): Promise<FindingAuditeeAccess> {
  const scope = await resolveFindingVisibilityScope(userEmail, userDepartman)
  if (scope.kind === "all") {
    return { isAdmin: true, isAuditee: false, calisanId: null }
  }
  if (scope.calisanId == null) {
    return { isAdmin: false, isAuditee: false, calisanId: null }
  }

  const finding = await prisma.auditFinding.findUnique({
    where: { id: findingId },
    select: {
      assignedToId: true,
      assignedGroupId: true,
      session: { select: { entry: { select: FINDING_SCOPE_ENTRY_SELECT } } },
      manualEntry: { select: FINDING_SCOPE_ENTRY_SELECT },
    },
  })
  if (!finding) {
    return { isAdmin: false, isAuditee: false, calisanId: scope.calisanId }
  }

  const candidate = extractFindingScopeCandidate(finding)
  return {
    isAdmin: false,
    isAuditee: findingMatchesLimitedScope(candidate, scope),
    calisanId: scope.calisanId,
  }
}

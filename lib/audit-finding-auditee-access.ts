import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { normalizeDepartmentKey } from "@/lib/department-access"
import { prisma } from "@/lib/prisma-server"

export type FindingAuditeeAccess = {
  isAdmin: boolean
  /** Bireysel auditee, Auditee Group/Department eşleşmesi veya doğrudan assignedTo eşleşmesi. */
  isAuditee: boolean
  calisanId: number | null
}

/**
 * Bir bulguya erişim/cevap verme yetkisini çözer: Audit Plan admini (canAccessAuditPlan) HER ZAMAN
 * erişebilir. Admin değilse — bulgunun bağlı olduğu denetime (checklist üzerinden veya manuel)
 * bireysel auditee olarak eklenmiş, Auditee Group/Department'ı kendi departmanıyla eşleşen veya
 * doğrudan bulguya assignedTo olarak atanmış kullanıcılar da erişebilir/cevap verebilir.
 * "Departmandan herhangi bir yetkili kişi denetime cevap verebilsin" gereksinimini karşılar.
 */
export async function resolveFindingAuditeeAccess(
  findingId: number,
  userEmail: string | null | undefined,
  userDepartman: string | null | undefined
): Promise<FindingAuditeeAccess> {
  if (canAccessAuditPlan(userEmail)) {
    return { isAdmin: true, isAuditee: false, calisanId: null }
  }

  if (!userEmail?.trim()) {
    return { isAdmin: false, isAuditee: false, calisanId: null }
  }

  const calisan = await prisma.calisan.findFirst({
    where: { email: { equals: userEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (!calisan) {
    return { isAdmin: false, isAuditee: false, calisanId: null }
  }

  const entryFields = {
    auditees: { select: { calisanId: true } },
    auditeeDepartments: { select: { departmentName: true } },
  } as const

  const finding = await prisma.auditFinding.findUnique({
    where: { id: findingId },
    select: {
      assignedToId: true,
      session: { select: { entry: { select: entryFields } } },
      manualEntry: { select: entryFields },
    },
  })
  if (!finding) {
    return { isAdmin: false, isAuditee: false, calisanId: calisan.id }
  }

  const entry = finding.session?.entry ?? finding.manualEntry ?? null
  const individualMatch = entry?.auditees.some((a) => a.calisanId === calisan.id) ?? false
  const departmentMatch = entry
    ? entry.auditeeDepartments.some(
        (d) => normalizeDepartmentKey(d.departmentName) === normalizeDepartmentKey(userDepartman)
      )
    : false
  const assigneeMatch = finding.assignedToId === calisan.id

  return {
    isAdmin: false,
    isAuditee: individualMatch || departmentMatch || assigneeMatch,
    calisanId: calisan.id,
  }
}

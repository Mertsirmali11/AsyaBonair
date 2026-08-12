import { prisma } from "@/lib/prisma-server"

/** OWNER/MANAGER: plan/bucket/task oluşturabilir, task silebilir, üye ekleyebilir. MEMBER: yalnızca kendisine/departmanına atanan task'ları güncelleyebilir. */
export type PlannerRole = "OWNER" | "MANAGER" | "MEMBER"

export function canManagePlan(role: PlannerRole | null): boolean {
  return role === "OWNER" || role === "MANAGER"
}

type CalisanLite = { id: number; isim: string | null; soyisim: string | null; departman: string | null }

async function findCalisanByEmail(email: string | null | undefined): Promise<CalisanLite | null> {
  if (!email?.trim()) return null
  return prisma.calisan.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, isim: true, soyisim: true, departman: true },
  })
}

export type PlannerPlanAccess = {
  calisan: CalisanLite | null
  role: PlannerRole | null
  isMember: boolean
}

/**
 * Bir Planner Plan'a erişim/yetki — SUNUCU TARAFINDA her plan/bucket/task mutasyonunda
 * çağrılmalıdır (yalnızca UI'da gizlemekle yetinilmez). Plan üyesi değilse role=null,
 * isMember=false döner — hiçbir Planner verisine erişemez (plan'lar üyelerine özeldir).
 */
export async function resolvePlannerPlanAccess(
  planId: number,
  email: string | null | undefined
): Promise<PlannerPlanAccess> {
  const calisan = await findCalisanByEmail(email)
  if (!calisan) return { calisan: null, role: null, isMember: false }

  const member = await prisma.plannerPlanMember.findUnique({
    where: { planId_calisanId: { planId, calisanId: calisan.id } },
    select: { role: true },
  })
  if (!member) return { calisan, role: null, isMember: false }

  return { calisan, role: member.role as PlannerRole, isMember: true }
}

export type PlannerTaskAccess = PlannerPlanAccess & {
  /** Plan üyesi + (OWNER/MANAGER veya bireysel atanmış veya atanmış departmanın üyesi) */
  canEdit: boolean
}

/**
 * Bir Planner Task üzerinde işlem yapma yetkisi. Departmana atanmış bir task'ta o
 * departmandaki HERHANGİ bir yetkili kullanıcı çalışabilir — ama işlemi yapan gerçek
 * kullanıcı her zaman `calisan.id` olarak PlannerTaskHistory'ye actorId ile yazılır,
 * departman adına anonim bir kayıt asla oluşmaz (bkz. çağıran route'lar).
 */
export async function resolvePlannerTaskAccess(
  taskId: number,
  email: string | null | undefined
): Promise<PlannerTaskAccess | null> {
  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    select: {
      planId: true,
      assignees: { select: { calisanId: true } },
      departments: { select: { departmentName: true } },
    },
  })
  if (!task) return null

  const planAccess = await resolvePlannerPlanAccess(task.planId, email)
  if (!planAccess.isMember || !planAccess.calisan) {
    return { ...planAccess, canEdit: false }
  }

  const isManager = canManagePlan(planAccess.role)
  const isIndividuallyAssigned = task.assignees.some((a) => a.calisanId === planAccess.calisan!.id)
  const isDepartmentAssigned =
    !!planAccess.calisan.departman &&
    task.departments.some((d) => d.departmentName === planAccess.calisan!.departman)

  return { ...planAccess, canEdit: isManager || isIndividuallyAssigned || isDepartmentAssigned }
}

export function calisanFullName(c: { isim: string | null; soyisim: string | null } | null | undefined): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

import type { Prisma } from "@prisma/client"
import { isAdminDepartment, normalizeDepartmentKey } from "@/lib/department-access"

/** Admin departmanı dashboard ve görev listesinde tüm atananların görevlerini görür. */
export function canViewAllMeetingTasks(
  departman: string | null | undefined
): boolean {
  return isAdminDepartment(departman)
}

/**
 * Prisma `meetingTask` sorgusu: admin → filtre yok; diğerleri → kendine atanan
 * görevler + kendi departmanına (kişi yerine departmana) atanan görevler.
 */
export function meetingTaskAssigneeWhere(
  departman: string | null | undefined,
  calisanId: number | null | undefined
): Prisma.MeetingTaskWhereInput {
  if (canViewAllMeetingTasks(departman)) return {}
  const or: Prisma.MeetingTaskWhereInput[] = []
  if (calisanId) or.push({ assigneeId: calisanId })
  if (departman && normalizeDepartmentKey(departman)) {
    or.push({ assignedDepartment: { equals: departman.trim(), mode: "insensitive" } })
  }
  if (or.length === 0) return { assigneeId: -1 }
  return { OR: or }
}

/** Kullanıcı, departmana atanmış bir görevin muhatabı mı (kişi ataması yoksa). */
export function isMeetingTaskDepartmentMember(
  assignedDepartment: string | null | undefined,
  viewerDepartman: string | null | undefined
): boolean {
  if (!assignedDepartment) return false
  return normalizeDepartmentKey(assignedDepartment) === normalizeDepartmentKey(viewerDepartman)
}

type VisibilityOptions = {
  /** /tasks: toplantısız Action Plan görevleri de listelenir */
  includeStandalone?: boolean
}

/**
 * Dashboard: yalnızca geçerli toplantıya bağlı görevler.
 * /tasks (includeStandalone): toplantısız yeni görevler + geçerli toplantı görevleri.
 * meetingId null yetimleri cleanup SQL ile silinmiş olmalı.
 */
export function meetingTaskListVisibilityWhere(
  options?: VisibilityOptions
): Prisma.MeetingTaskWhereInput {
  const linkedToActiveMeeting = {
    meetingId: { not: null },
    meeting: { status: { not: "Archived" } },
  } satisfies Prisma.MeetingTaskWhereInput

  if (options?.includeStandalone) {
    return {
      OR: [{ meetingId: null }, linkedToActiveMeeting],
    }
  }

  return linkedToActiveMeeting
}
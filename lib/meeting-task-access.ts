import type { Prisma } from "@prisma/client"
import { isAdminDepartment } from "@/lib/department-access"

/** Admin departmanı dashboard ve görev listesinde tüm atananların görevlerini görür. */
export function canViewAllMeetingTasks(
  departman: string | null | undefined
): boolean {
  return isAdminDepartment(departman)
}

/** Prisma `meetingTask` sorgusu: admin → filtre yok; diğerleri → yalnızca kendi görevleri. */
export function meetingTaskAssigneeWhere(
  departman: string | null | undefined,
  calisanId: number | null | undefined
): { assigneeId?: number } {
  if (canViewAllMeetingTasks(departman)) return {}
  if (calisanId) return { assigneeId: calisanId }
  return { assigneeId: -1 }
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
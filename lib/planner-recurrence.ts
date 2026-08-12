import { prisma } from "@/lib/prisma-server"
import { logPlannerTaskHistory } from "@/lib/planner-task-history"

function addInterval(date: Date, rule: string, intervalDays: number | null): Date {
  const d = new Date(date)
  switch (rule) {
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1)
      break
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3)
      break
    case "SEMIANNUAL":
      d.setMonth(d.getMonth() + 6)
      break
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1)
      break
    case "CUSTOM":
      d.setDate(d.getDate() + (intervalDays ?? 30))
      break
  }
  return d
}

/**
 * Bir recurring task tamamlandığında sonraki occurrence'ı oluşturur. Yalnızca ŞABLON
 * bilgisini kopyalar — title/description/bucket/assignees/departments/recurrence
 * ayarları/checklist YAPISI (maddeler, hepsi tekrar isDone=false). Comment ve
 * attachment ASLA kopyalanmaz — yeni occurrence temiz başlar. Yeni occurrence
 * recurrenceParentId ile tamamlanan task'a bağlanır; zincir boyunca geriye doğru
 * takip edilerek "previous/original" her zaman bulunabilir. Tamamlanan task'ın
 * kendi geçmişi (PlannerTaskHistory) hiçbir şekilde kopyalanmaz/tekrarlanmaz —
 * yalnızca "RECURRENCE_CREATED" tek satırlık bir olay eklenir.
 */
export async function maybeCreateNextOccurrence(completedTaskId: number, actorId: number | null): Promise<number | null> {
  const task = await prisma.plannerTask.findUnique({
    where: { id: completedTaskId },
    include: {
      assignees: true,
      departments: true,
      checklistItems: { orderBy: { sortOrder: "asc" } },
    },
  })
  if (!task || !task.recurrenceRule) return null

  const baseDate = task.dueDate ?? new Date()
  const nextDue = addInterval(baseDate, task.recurrenceRule, task.recurrenceIntervalDays)
  const nextStart = task.startDate ? addInterval(task.startDate, task.recurrenceRule, task.recurrenceIntervalDays) : null

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { bucketId: task.bucketId, deletedAt: null },
    _max: { sortOrder: true },
  })

  const next = await prisma.plannerTask.create({
    data: {
      planId: task.planId,
      bucketId: task.bucketId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: "Not Started",
      labels: task.labels,
      startDate: nextStart,
      dueDate: nextDue,
      recurrenceRule: task.recurrenceRule,
      recurrenceIntervalDays: task.recurrenceIntervalDays,
      recurrenceParentId: task.id,
      createdBy: task.createdBy,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      assignees: { create: task.assignees.map((a) => ({ calisanId: a.calisanId })) },
      departments: { create: task.departments.map((d) => ({ departmentName: d.departmentName })) },
      checklistItems: { create: task.checklistItems.map((c) => ({ label: c.label, sortOrder: c.sortOrder })) },
    },
  })

  try {
    await logPlannerTaskHistory(task.id, actorId, "RECURRENCE_CREATED", `Sonraki occurrence oluşturuldu: #${next.id}.`)
    await logPlannerTaskHistory(next.id, actorId, "CREATED", `"${task.title}" görevinin tekrarı olarak otomatik oluşturuldu (önceki: #${task.id}).`)
  } catch {
    // Geçmiş kaydı başarısız olsa bile occurrence oluşturma geçerli kalır
  }

  return next.id
}

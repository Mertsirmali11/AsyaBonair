import { prisma } from "@/lib/prisma-server"

/**
 * PlannerTaskHistory'ye tek satır ekler. actorId HER ZAMAN işlemi yapan gerçek
 * kullanıcının id'sidir — departmana atanmış bir task'ta bile departman adına
 * anonim bir kayıt asla oluşturulmaz, çağıran route'lar her zaman gerçek
 * kullanıcının calisan.id'sini geçirir. Geçmiş kaydı başarısız olsa bile ana
 * işlemi asla etkilememesi için çağıran taraf try/catch içine almalıdır.
 */
export async function logPlannerTaskHistory(
  taskId: number,
  actorId: number | null,
  eventType: string,
  note?: string | null
): Promise<void> {
  await prisma.plannerTaskHistory.create({
    data: { taskId, actorId, eventType, note: note ?? null },
  })
}

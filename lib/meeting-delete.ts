import type { PrismaClient } from "@prisma/client"

/**
 * KURAL — Toplantı ↔ görev yaşam döngüsü
 * ----------------------------------------
 * Bir toplantı silindiğinde, o toplantıya bağlı (meetingId) tüm görevler
 * veritabanından kaldırılır. Görev mesajları ve ekleri FK cascade ile silinir.
 *
 * Toplantı silinince meetingId artık SET NULL yapılmaz; görevler tamamen silinir.
 * Eski yetim kayıtlar (meeting_id NULL) listede gösterilmez ve cleanup SQL ile temizlenebilir.
 *
 * Arşivlenmiş toplantılar silinmez; görevleri listede gizlenir (bkz.
 * meetingTaskListVisibilityWhere).
 */
export async function deleteMeetingWithLinkedTasks(
  prisma: PrismaClient,
  meetingId: number
): Promise<void> {
  await prisma.$transaction([
    prisma.meetingTask.deleteMany({ where: { meetingId } }),
    prisma.meeting.delete({ where: { id: meetingId } }),
  ])
}

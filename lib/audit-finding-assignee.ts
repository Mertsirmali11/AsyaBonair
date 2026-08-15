import "server-only"

import { prisma } from "@/lib/prisma-server"

export type AssignmentValidation = { ok: true } | { ok: false; status: number; error: string }

/**
 * `AuditFinding.assignedToId` / `assignedGroupId` KARŞILIKLI DIŞLAYICI — ikisi birden dolu
 * olamaz. Bu, tüm finding create/edit route'larının (manuel Add Finding, Finding Edit) çağırdığı
 * TEK doğrulama noktası; her route kendi "omitted alan ne anlama gelir" mantığını (create'te
 * varsayılan ilk auditee, edit'te "gönderilmemişse dokunma") kendi çözer, ama nihai
 * (assignedToId, assignedGroupId) çiftini yazmadan ÖNCE mutlaka bunu çağırır.
 */
export async function validateFindingAssignment(
  assignedToId: number | null,
  assignedGroupId: number | null
): Promise<AssignmentValidation> {
  if (assignedToId != null && assignedGroupId != null) {
    return { ok: false, status: 400, error: "Bir bulgu aynı anda hem bir kişiye hem bir gruba atanamaz." }
  }
  if (assignedGroupId != null) {
    const group = await prisma.userGroup.findFirst({
      where: { id: assignedGroupId, deletedAt: null },
      select: { id: true },
    })
    if (!group) {
      return { ok: false, status: 400, error: "Geçersiz veya silinmiş grup." }
    }
  }
  return { ok: true }
}

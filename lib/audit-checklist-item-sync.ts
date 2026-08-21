import type { ParsedChecklistItem } from "@/lib/audit-checklist-items-parse"

export type ChecklistItemUpdate = ParsedChecklistItem & { existingId: number }

export type ChecklistItemSyncPlan = {
  /** Mevcut satırlar — kendi `existingId`'sine yazılır, id/pozisyon hiç değişmez. */
  updates: ChecklistItemUpdate[]
  /** Karşılığı olmayan (yeni) satırlar — her zaman YENİ id alır. */
  itemsToCreate: ParsedChecklistItem[]
  /** Payload'da karşılığı kalmayan VE hiçbir denetimde kullanılmamış satırlar — silinebilir. */
  idsToDelete: number[]
  /**
   * Payload'da karşılığı kalmayan AMA bir AuditSession'da kullanılmış (cevaplanmış) satırlar —
   * asla silinmez/mutate edilmez, session geçmişi bozulmasın diye olduğu gibi bırakılır.
   */
  protectedMissingIds: number[]
}

/**
 * Gelen editör satırlarını mevcut DB satırlarıyla STABİL ID üzerinden eşler — pozisyon/index
 * hiçbir zaman kullanılmaz. Aynı `existingId` birden fazla kez gelirse (örn. istemci hatası)
 * son değer geçerli olur; bu checklist'e ait olmayan/bulunamayan bir `existingId` yeni satır
 * gibi işlenir (başka bir checklist'in id'sini kazara ele geçirmeyi engeller).
 */
export function planChecklistItemSync(
  items: ParsedChecklistItem[],
  existingIds: Iterable<number>,
  usedIds: Iterable<number>
): ChecklistItemSyncPlan {
  const existingIdSet = new Set(existingIds)
  const usedIdSet = new Set(usedIds)

  const updatesByExistingId = new Map<number, ChecklistItemUpdate>()
  const itemsToCreate: ParsedChecklistItem[] = []
  for (const it of items) {
    if (it.existingId !== null && existingIdSet.has(it.existingId)) {
      updatesByExistingId.set(it.existingId, { ...it, existingId: it.existingId })
    } else {
      itemsToCreate.push(it)
    }
  }
  const updates = [...updatesByExistingId.values()]

  const missingIds = [...existingIdSet].filter((eid) => !updatesByExistingId.has(eid))
  const idsToDelete = missingIds.filter((eid) => !usedIdSet.has(eid))
  const protectedMissingIds = missingIds.filter((eid) => usedIdSet.has(eid))

  return { updates, itemsToCreate, idsToDelete, protectedMissingIds }
}

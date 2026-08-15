import "server-only"

import { prisma } from "@/lib/prisma-server"
import { isSacaOrSafaAuditCategory, normalizeFindingCategory } from "@/lib/finding-category"
import { isResultKey } from "@/lib/audit-checklist-result"

/**
 * Bir `AuditSessionItem`in resmi cevabını (result/notes/auditeeNotes) yazan TEK yer.
 * Hem auditor'un "Denetim Yürüt" ekranındaki PUT /api/audit-sessions/[id]/items hem de
 * Manage Audit'teki "Accept auditee response" akışı BU fonksiyonu çağırır — paralel bir
 * save/validation mantığı YOKTUR. Orijinal davranış app/api/audit-sessions/[id]/items/route.ts
 * PUT'tan birebir taşınmıştır.
 */
export type AuditSessionItemAnswerInput = {
  auditSessionId: number
  auditChecklistItemId: number
  result: string | null
  /** undefined = mevcut auditor notuna DOKUNMA (yalnızca Accept akışı bunu kullanır — auditee
   * bir auditor notu göndermez). Auditor'un kendi PUT'u her zaman açık bir değer gönderir. */
  notes: string | null | undefined
  auditeeNotes: string | null
}

export type AuditSessionItemAnswerResult =
  | { ok: true; sessionItem: { id: number } }
  | { ok: false; status: number; error: string }

/**
 * Public Audit Response Link'ten bir checklist sorusuna cevap gelirken kullanılır: auditor
 * "Denetim Yürüt" ekranını HİÇ AÇMAMIŞ olabilir, yani ne AuditSession ne de AuditSessionItem
 * var olabilir. Bu fonksiyon ikisini de yoksa idempotent biçimde oluşturur (result/notes'a
 * DOKUNMADAN, null bırakarak — client-side ensureSessionItemId ile birebir aynı prensip,
 * yalnızca sunucu tarafı eşdeğeri). AuditSessionItem'ın unique constraint'i sayesinde eşzamanlı
 * çağrılar güvenlidir (upsert).
 */
export async function ensureActiveAuditSessionItem(
  auditPlanEntryId: number,
  auditChecklistId: number,
  auditChecklistItemId: number
): Promise<{ sessionId: number; sessionItemId: number }> {
  let activeSession = await prisma.auditSession.findFirst({
    where: { auditPlanEntryId, auditChecklistId, archivedAt: null },
    select: { id: true },
  })
  if (!activeSession) {
    activeSession = await prisma.auditSession.create({
      data: { auditPlanEntryId, auditChecklistId, status: "InProgress" },
      select: { id: true },
    })
  }
  const sessionItem = await prisma.auditSessionItem.upsert({
    where: { auditSessionId_auditChecklistItemId: { auditSessionId: activeSession.id, auditChecklistItemId } },
    create: { auditSessionId: activeSession.id, auditChecklistItemId, result: null, notes: null, auditeeNotes: null },
    update: {},
  })
  return { sessionId: activeSession.id, sessionItemId: sessionItem.id }
}

export async function upsertAuditSessionItemAnswer(
  input: AuditSessionItemAnswerInput
): Promise<AuditSessionItemAnswerResult> {
  const { auditSessionId, auditChecklistItemId, result, notes, auditeeNotes } = input

  if (!Number.isInteger(auditChecklistItemId) || auditChecklistItemId < 1) {
    return { ok: false, status: 400, error: "Invalid auditChecklistItemId" }
  }
  if (result !== null && !isResultKey(result)) {
    return { ok: false, status: 400, error: "Invalid result. Use S, U, NA, OBS or null" }
  }

  const clItem = await prisma.auditChecklistItem.findFirst({
    where: { id: auditChecklistItemId },
    select: { id: true, auditChecklistId: true },
  })
  const auditSession = await prisma.auditSession.findUnique({
    where: { id: auditSessionId },
    select: { auditChecklistId: true },
  })
  if (!auditSession) return { ok: false, status: 404, error: "Session not found" }
  if (!clItem || clItem.auditChecklistId !== auditSession.auditChecklistId) {
    return { ok: false, status: 404, error: "Checklist item not found in this session" }
  }

  const sessionItem = await prisma.auditSessionItem.upsert({
    where: {
      auditSessionId_auditChecklistItemId: { auditSessionId, auditChecklistItemId },
    },
    // notes undefined ise (yalnızca Accept akışı) create'te null, update'te MEVCUT auditor
    // notuna hiç dokunulmaz — Prisma'da bir alanı update objesinden tamamen çıkarmak "bu
    // alana dokunma" anlamına gelir.
    create: { auditSessionId, auditChecklistItemId, result, notes: notes ?? null, auditeeNotes },
    update: { result, auditeeNotes, ...(notes !== undefined ? { notes } : {}) },
  })

  return { ok: true, sessionItem: { id: sessionItem.id } }
}

/**
 * result="U" (Unsatisfactory) olduğunda otomatik Finding oluşturma/güncelleme/kaldırma —
 * PUT /api/audit-sessions/[id]/items'ın orijinal davranışı, birebir taşınmıştır. SACA/SAFA
 * denetimlerinde findingCategory ZORUNLUDUR (server-side) — bu yüzden Accept akışı bu
 * fonksiyonu BİLEREK çağırmaz (auditee bir kategori seçmez; auditor bunu ayrı "Add Finding"
 * aksiyonuyla, kendi sınıflandırma kararıyla ekler — bkz. audit-plan/[id]/findings/route.ts).
 */
export type FindingSyncInput = {
  auditSessionId: number
  sessionItemId: number
  result: string | null
  notes: string | null
  rawFindingLevel: string
  rawFindingCategory: unknown
}

export type FindingSyncResult = { ok: true } | { ok: false; status: number; error: string }

export async function syncFindingForSessionItemResult(input: FindingSyncInput): Promise<FindingSyncResult> {
  const { auditSessionId, sessionItemId, result, notes, rawFindingLevel, rawFindingCategory } = input

  const auditSession = await prisma.auditSession.findUnique({
    where: { id: auditSessionId },
    include: {
      entry: {
        include: {
          auditCategoryType: { select: { name: true } },
          auditSubCategoryType: { select: { name: true } },
          auditees: { select: { calisanId: true }, take: 1 },
        },
      },
    },
  })
  if (!auditSession) return { ok: false, status: 404, error: "Session not found" }

  const isSacaSafa = isSacaOrSafaAuditCategory(auditSession.entry.auditCategoryType.name)

  let findingLevel: string | null = null
  if (!isSacaSafa) {
    findingLevel = rawFindingLevel
    const validLevels = ["Level1", "Level2", "Observation"]
    if (!validLevels.includes(findingLevel)) {
      return { ok: false, status: 400, error: "Invalid findingLevel" }
    }
  }

  const findingCategory = normalizeFindingCategory(rawFindingCategory, auditSession.entry.auditCategoryType.name)
  if (isSacaSafa && result === "U" && !findingCategory) {
    return { ok: false, status: 400, error: "Finding Category zorunludur" }
  }

  const clItem = await prisma.auditSessionItem.findUnique({
    where: { id: sessionItemId },
    select: { checklistItem: { select: { label: true, reference: true } } },
  })

  if (result === "U") {
    const existingFinding = await prisma.auditFinding.findUnique({ where: { auditSessionItemId: sessionItemId } })

    if (!existingFinding) {
      const count = await prisma.auditFinding.count()
      const findingCode = `BON-AF-${String(count + 1).padStart(3, "0")}`
      const cat = auditSession.entry.auditCategoryType.name
      const sub = auditSession.entry.auditSubCategoryType?.name
      const field = sub ? `${cat} — ${sub}` : cat
      const auditNumber = auditSession.entry.auditNumberPrefix
        ? `${auditSession.entry.auditNumberPrefix}-${auditSession.entry.id}`
        : `AP-${auditSession.entry.id}`

      let dueDate: Date | null = null
      if (findingLevel === "Level1") {
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 10)
      } else if (findingLevel === "Level2") {
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 90)
      }

      const auditeeId = auditSession.entry.auditees[0]?.calisanId ?? null

      await prisma.auditFinding.create({
        data: {
          findingCode,
          auditSessionId,
          auditSessionItemId: sessionItemId,
          findingLevel,
          findingCategory,
          explanation: notes ?? clItem?.checklistItem.label ?? "",
          reference: clItem?.checklistItem.reference ?? null,
          field,
          auditNumber,
          dueDate,
          status: "Open",
          ...(auditeeId ? { assignedToId: auditeeId } : {}),
        },
      })
    } else if (existingFinding.deletedAt) {
      let dueDate: Date | null = null
      if (findingLevel === "Level1") {
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 10)
      } else if (findingLevel === "Level2") {
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 90)
      }
      await prisma.auditFinding.update({
        where: { id: existingFinding.id },
        data: { deletedAt: null, findingLevel, findingCategory, status: "Open", dueDate },
      })
    } else if (existingFinding.findingLevel !== findingLevel) {
      let dueDate: Date | null = null
      if (findingLevel === "Level1") {
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 10)
      } else if (findingLevel === "Level2") {
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 90)
      }
      await prisma.auditFinding.update({
        where: { id: existingFinding.id },
        data: { findingLevel, findingCategory, dueDate },
      })
    } else if (existingFinding.findingCategory !== findingCategory) {
      await prisma.auditFinding.update({ where: { id: existingFinding.id }, data: { findingCategory } })
    }
  } else {
    const existingFinding = await prisma.auditFinding.findUnique({ where: { auditSessionItemId: sessionItemId } })
    if (existingFinding && !existingFinding.deletedAt && existingFinding.status === "Open") {
      const responseCount = await prisma.auditFindingResponse.count({ where: { auditFindingId: existingFinding.id } })
      if (responseCount === 0) {
        await prisma.auditFinding.delete({ where: { id: existingFinding.id } })
      }
    }
  }

  return { ok: true }
}

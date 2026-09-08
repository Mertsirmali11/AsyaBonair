import { Prisma, type PrismaClient } from "@prisma/client"
import { deletePdfFromStorage } from "@/lib/supabase-storage"

/**
 * `AuditPlanEntry` hard-delete karar mantığı — `app/api/audit-plan/[id]/route.ts` DELETE'i
 * ve `scripts/smoke-test-audit-deletion.ts` BU dosyayı çağırır, paralel bir kopya YAZILMAZ.
 *
 * Bilinçli ayrım: "gerçek" denetim verisi (auditor'ın fiilen cevapladığı checklist maddesi,
 * bulgu, dosya, denetlenen notu, hâlâ aktif bir Public Response Link) varsa hard-delete
 * KESİNLİKLE engellenir — kullanıcı "Cancelled" ile arşivlemeye yönlendirilir. Yalnızca
 * response-link TESTİ sırasında `ensureActiveAuditSessionItem` (bkz. audit-session-item-answer.ts)
 * tarafından otomatik oluşturulan, auditor'ın hiç dokunmadığı (result/notes null) boş
 * AuditSession/AuditSessionItem'lar, bunlara asılı AuditeeChecklistSubmission (+dosyaları) ve
 * revoke edilmiş AuditResponseLink kayıtları varsa "veri yok" sayılır ve silmeye izin verilir.
 *
 * `PrismaClient` burada parametre olarak alınır (uygulamanın `@/lib/prisma-server` singleton'ı
 * import edilmez) — bu sayede aynı fonksiyon hem Next.js route'undan (app singleton ile) hem de
 * `scripts/smoke-test-audit-deletion.ts`'ten (standalone PrismaClient ile, `server-only`
 * kısıtına takılmadan — bkz. scripts/verify-migration-20260824.ts'teki aynı gerekçe)
 * değişiklik yapılmadan çağrılabilir.
 *
 * Storage → DB sırası bilinçli (bkz. `deleteAuditPlanEntryIfSafe`): storage silme başarısız
 * olursa DB'ye hiç dokunulmaz. Storage silme BAŞARILI olduktan sonra `db.auditPlanEntry.delete()`
 * geçici bir nedenle (bağlantı/timeout) başarısız olursa dosyalar zaten gitmiş olur — bu pencereyi
 * kapatmak için son DB silme adımı en fazla 3 deneme (kısa backoff'lu) yapılır; kaydın zaten var
 * olmadığını gösteren (`P2025`) hata YENİDEN DENENMEZ, doğrudan gerçek 404 olarak döner.
 */

/** `db.auditPlanEntry.delete()` için: ilk hatadan sonra ~300ms, ikinci hatadan sonra ~800ms bekle (toplam 3 deneme). */
const DB_DELETE_RETRY_DELAYS_MS = [300, 800]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Kayıt zaten yok (ör. eşzamanlı başka bir istek tarafından silinmiş) — yeniden denemeye gerek yok. */
function isRecordNotFoundError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025"
}

export type AuditPlanEntryDeletionReasonCode =
  | "completed"
  | "checklist_answer_exists"
  | "finding_exists"
  | "audit_file_exists"
  | "auditee_note_exists"
  | "active_response_link_exists"

export type AuditPlanEntryDeletionCheck =
  | { deletable: true }
  | {
      deletable: false
      status: 404 | 409
      error: string
      reasons?: AuditPlanEntryDeletionReasonCode[]
    }

/**
 * Yalnızca kontrol — hiçbir DB/Storage yan etkisi yoktur. Silme engelliyse nedenini
 * (`reasons`) ve kullanıcıya gösterilecek Türkçe mesajı döner.
 */
export async function checkAuditPlanEntryDeletable(
  db: PrismaClient,
  id: number
): Promise<AuditPlanEntryDeletionCheck> {
  const entry = await db.auditPlanEntry.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      _count: { select: { documents: true, responseNotes: true } },
    },
  })
  if (!entry) {
    return { deletable: false, status: 404, error: "Not found" }
  }

  if (entry.status === "Completed") {
    return {
      deletable: false,
      status: 409,
      error: "Completed audits cannot be deleted. Please cancel/archive instead.",
      reasons: ["completed"],
    }
  }

  const [findingsCount, answeredSessionItemsCount, activeResponseLinksCount] = await Promise.all([
    db.auditFinding.count({
      where: { deletedAt: null, OR: [{ auditPlanEntryId: id }, { session: { auditPlanEntryId: id } }] },
    }),
    // Auditor tarafından fiilen cevaplanmış (result ve/veya notes dolu) herhangi bir madde —
    // response-link testi sırasında otomatik oluşan boş AuditSessionItem'lar result/notes'u
    // hiç yazmadığı için burada sayılmaz.
    db.auditSessionItem.count({
      where: {
        session: { auditPlanEntryId: id },
        OR: [{ result: { not: null } }, { notes: { not: null } }],
      },
    }),
    db.auditResponseLink.count({
      where: { auditPlanEntryId: id, revokedAt: null },
    }),
  ])

  const reasons: { code: AuditPlanEntryDeletionReasonCode; message: string }[] = []
  if (answeredSessionItemsCount > 0) {
    reasons.push({ code: "checklist_answer_exists", message: "checklist cevapları girilmiş" })
  }
  if (findingsCount > 0) {
    reasons.push({ code: "finding_exists", message: "bulgular bulunuyor" })
  }
  if (entry._count.documents > 0) {
    reasons.push({ code: "audit_file_exists", message: "denetim dosyaları yüklenmiş" })
  }
  if (entry._count.responseNotes > 0) {
    reasons.push({ code: "auditee_note_exists", message: "denetlenen notu gönderilmiş" })
  }
  if (activeResponseLinksCount > 0) {
    reasons.push({
      code: "active_response_link_exists",
      message: "aktif (iptal edilmemiş) bir Public Response Link bulunuyor",
    })
  }

  if (reasons.length > 0) {
    return {
      deletable: false,
      status: 409,
      error: `Bu denetim silinemez: ${reasons.map((r) => r.message).join(", ")}. Bunun yerine denetimi İptal Et (Cancelled) ile arşivleyin.`,
      reasons: reasons.map((r) => r.code),
    }
  }

  return { deletable: true }
}

/**
 * Entry'ye bağlı, DB cascade ile birlikte silinecek (ama Postgres cascade'in Storage'a
 * dokunmayacağı) tüm dosya yollarını toplar — çağıran taraf DB silme işleminden ÖNCE
 * bunları storage'dan temizlemelidir.
 */
export async function collectAuditPlanEntryOrphanableStoragePaths(
  db: PrismaClient,
  id: number
): Promise<string[]> {
  const [sessionAttachments, submissionFiles] = await Promise.all([
    db.auditSessionItemAttachment.findMany({
      where: { sessionItem: { session: { auditPlanEntryId: id } } },
      select: { storagePath: true },
    }),
    db.auditeeChecklistSubmissionFile.findMany({
      where: { submission: { sessionItem: { session: { auditPlanEntryId: id } } } },
      select: { storagePath: true },
    }),
  ])

  return [...new Set([...sessionAttachments, ...submissionFiles].map((f) => f.storagePath))]
}

export type DeleteAuditPlanEntryResult =
  | { ok: true }
  | { ok: false; status: number; error: string; reasons?: AuditPlanEntryDeletionReasonCode[] }

/**
 * Tam akış: kontrol → (engelliyse dur) → storage temizliği → `db.auditPlanEntry.delete()`
 * (en fazla 3 deneme). Storage silme herhangi bir dosya için başarısız olursa DB kaydına HİÇ
 * dokunulmaz (orphan/partial deletion önlenir) ve 500 döner. `deleteStorageFile`/`deleteEntry`
 * yalnızca test amaçlı enjekte edilebilir — üretimde her zaman gerçek `deletePdfFromStorage` ve
 * gerçek `db.auditPlanEntry.delete()` kullanılır.
 */
export async function deleteAuditPlanEntryIfSafe(
  db: PrismaClient,
  id: number,
  opts?: {
    deleteStorageFile?: (path: string) => Promise<boolean>
    deleteEntry?: (entryId: number) => Promise<void>
  }
): Promise<DeleteAuditPlanEntryResult> {
  const check = await checkAuditPlanEntryDeletable(db, id)
  if (!check.deletable) {
    return { ok: false, status: check.status, error: check.error, reasons: check.reasons }
  }

  const storagePaths = await collectAuditPlanEntryOrphanableStoragePaths(db, id)
  const deleteStorageFile = opts?.deleteStorageFile ?? deletePdfFromStorage
  const deleteEntry =
    opts?.deleteEntry ?? (async (entryId: number) => { await db.auditPlanEntry.delete({ where: { id: entryId } }) })

  // Storage silmeye başlamadan ÖNCE, hangi entry için hangi path'lerin silineceğini structured
  // log'a yaz — storage başarılı olup DB silme (retry'lardan sonra bile) başarısız kalırsa, bu
  // tek log satırı hangi dosyaların artık DB'siz kaldığını (manuel inceleme/reconciliation için)
  // gösteren tek kalıcı iz olur. Secret/anahtar/token İÇERMEZ — yalnızca entry id + bucket path'leri.
  console.log("[audit-plan-entry-deletion] storage cleanup starting", {
    operation: "deleteAuditPlanEntryIfSafe",
    auditPlanEntryId: id,
    storagePaths,
  })

  for (const path of storagePaths) {
    const removed = await deleteStorageFile(path)
    if (!removed) {
      console.error("[audit-plan-entry-deletion] storage cleanup failed, aborting before DB delete", {
        id,
        path,
      })
      return {
        ok: false,
        status: 500,
        error:
          "Depodaki dosyalar temizlenemedi, silme işlemi iptal edildi (kayıt silinmedi). Lütfen tekrar deneyin veya sistem yöneticisiyle iletişime geçin.",
      }
    }
  }

  // Storage tarafı artık geri dönüşsüz şekilde temiz — bu noktadan sonra DB silme geçici bir
  // nedenle (bağlantı/timeout) başarısız olursa dosyalar zaten silinmiş olacağından, bu adımı
  // birkaç kez deniyoruz. Kaydın zaten var olmadığını gösteren P2025 YENİDEN DENENMEZ.
  let lastError: unknown
  for (let attempt = 1; attempt <= 1 + DB_DELETE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      await deleteEntry(id)
      return { ok: true }
    } catch (e) {
      lastError = e

      if (isRecordNotFoundError(e)) {
        console.error("[audit-plan-entry-deletion] entry already gone (P2025), not retrying", { id, attempt })
        return { ok: false, status: 404, error: "Not found" }
      }

      const isLastAttempt = attempt === 1 + DB_DELETE_RETRY_DELAYS_MS.length
      if (isLastAttempt) break

      const delayMs = DB_DELETE_RETRY_DELAYS_MS[attempt - 1]
      console.error("[audit-plan-entry-deletion] entry delete attempt failed, retrying", {
        id,
        attempt,
        delayMs,
      })
      await sleep(delayMs)
    }
  }

  console.error(
    "[audit-plan-entry-deletion] entry delete failed after storage cleanup and all retries",
    { id },
    lastError
  )
  return {
    ok: false,
    status: 500,
    error:
      "Depodaki dosyalar temizlendi ancak denetim kaydı silinemedi. Lütfen tekrar deneyin veya sistem yöneticisiyle iletişime geçin.",
  }
}

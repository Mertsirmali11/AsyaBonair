/**
 * Gerçek prod DB'ye (ve gerçek Supabase Storage bucket'ına) karşı self-contained smoke test —
 * `lib/audit-plan-entry-deletion.ts`'in AuditPlanEntry hard-delete karar mantığını doğrular
 * (SILINECEK-41 vakasının kök nedeni: response-link testi sırasında otomatik oluşan boş
 * AuditSession/AuditSessionItem + revoke edilmiş AuditResponseLink, "gerçek veri" ile
 * karıştırılıp silmeyi engelliyordu).
 *
 * Kendi test verisini oluşturur, doğrular, SONRA TAMAMEN TEMİZLER — hiçbir kalıcı iz
 * bırakmaz. Mevcut hiçbir kayda dokunmaz (yalnızca "__SMOKE_TEST_DELETION__" işaretli kendi
 * satırlarını oluşturup siler; year=9999 kullanır ki gerçek yıllarla hiç çakışmasın).
 *
 * Standalone PrismaClient (server-only import'u olmayan) — bkz. scripts/verify-migration-
 * 20260824.ts'teki aynı gerekçe: lib/prisma-server.ts "server-only" işaretli olduğundan düz
 * bir tsx script'inden import edilemez. Bu yüzden lib/audit-plan-entry-deletion.ts, PrismaClient'ı
 * parametre olarak alacak şekilde tasarlandı — üretimde app'in kendi singleton'ı (@/lib/prisma-
 * server), burada bu script'in kendi standalone client'ı geçirilir; iş mantığı birebir aynı.
 *
 * Çalıştırma: npx tsx scripts/smoke-test-audit-deletion.ts
 */
import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"
import { randomBytes } from "crypto"
import { Prisma, PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

import {
  checkAuditPlanEntryDeletable,
  deleteAuditPlanEntryIfSafe,
} from "../lib/audit-plan-entry-deletion"
import { uploadBinaryToStorage, downloadPdfFromStorage } from "../lib/supabase-storage"

const envLocalPath = resolve(process.cwd(), ".env.local")
const envPath = resolve(process.cwd(), ".env")
config({ path: existsSync(envLocalPath) ? envLocalPath : envPath })

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL is not set.")
const cleanConnectionString = connectionString.startsWith("prisma+postgres://")
  ? connectionString.replace("prisma+postgres://", "postgresql://")
  : connectionString

const pool = new Pool({ connectionString: cleanConnectionString, max: 3, connectionTimeoutMillis: 20000 })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error", "warn"] })

const SMOKE_YEAR = 9999 // gerçek hiçbir Audit Plan yılıyla çakışmaz
const smokeDate = new Date(Date.UTC(SMOKE_YEAR, 0, 1))
let failed = 0
function check(name: string, cond: boolean, detail?: unknown) {
  const ok = !!cond
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ""}`)
}

function randomToken(): string {
  return randomBytes(32).toString("base64url")
}

// AuditPlanEntry id'leri — sonda hepsi (silinmemiş kalanlar) manuel temizlenir.
const createdEntryIds: number[] = []

async function createEntry(): Promise<number> {
  const entry = await prisma.auditPlanEntry.create({
    data: {
      auditType: "PLANNED",
      plannedDate: smokeDate,
      auditCategoryTypeId: categoryId,
      status: "Initialized",
      remarks: "__SMOKE_TEST_DELETION__",
    },
  })
  createdEntryIds.push(entry.id)
  return entry.id
}

/** Yalnızca arşivlenmiş/boş session + revoke edilmiş link + auditee submission — "silinebilir" şekil. */
async function createSafeShellEntry(): Promise<number> {
  const entryId = await createEntry()
  const auditSession = await prisma.auditSession.create({
    data: { auditPlanEntryId: entryId, auditChecklistId: checklistId, status: "InProgress", archivedAt: new Date() },
  })
  const sessionItem = await prisma.auditSessionItem.create({
    data: { auditSessionId: auditSession.id, auditChecklistItemId: checklistItemId, result: null, notes: null },
  })
  const link = await prisma.auditResponseLink.create({
    data: { auditPlanEntryId: entryId, token: randomToken(), revokedAt: new Date() },
  })
  await prisma.auditeeChecklistSubmission.create({
    data: {
      auditSessionItemId: sessionItem.id,
      responseLinkId: link.id,
      auditeeResponse: "S",
      auditeeNote: "smoke test response",
      submitterName: "Smoke Tester",
      reviewStatus: "Pending",
    },
  })
  return entryId
}

let categoryId: number
let checklistId: number
let checklistItemId: number

async function setupFixtures() {
  const category = await prisma.auditCategoryType.create({
    data: { name: "__SMOKE_TEST_DELETION_CATEGORY__", scopes: ["PLANNED"], sortOrder: -999, isActive: true },
  })
  categoryId = category.id

  const checklist = await prisma.auditChecklist.create({
    data: { title: "__SMOKE_TEST_DELETION_CHECKLIST__", isActive: true, sortOrder: -999 },
  })
  checklistId = checklist.id

  const item = await prisma.auditChecklistItem.create({
    data: { auditChecklistId: checklist.id, label: "__SMOKE_TEST_ITEM__", sortOrder: 0 },
  })
  checklistItemId = item.id
}

async function teardownFixtures() {
  // Kalan (silinmeyen / bilerek silinmemiş) entry'ler — Cascade her şeyi (session/item/
  // submission/link/finding/document/note) birlikte temizler.
  for (const id of createdEntryIds) {
    await prisma.auditPlanEntry.delete({ where: { id } }).catch(() => {})
  }
  await prisma.auditChecklistItem.deleteMany({ where: { auditChecklistId: checklistId } }).catch(() => {})
  await prisma.auditChecklist.delete({ where: { id: checklistId } }).catch(() => {})
  await prisma.auditCategoryType.delete({ where: { id: categoryId } }).catch(() => {})
}

async function main() {
  await setupFixtures()

  // --- 1) Yalnızca revoked link + boş/arşivli session + auditee submission → DELETE başarılı ---
  {
    const id = await createSafeShellEntry()
    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check("1a) safe-shell entry: checkAuditPlanEntryDeletable → deletable:true", decision.deletable === true, decision)

    const result = await deleteAuditPlanEntryIfSafe(prisma, id)
    check("1b) safe-shell entry: deleteAuditPlanEntryIfSafe → ok:true", result.ok === true, result)

    const stillThere = await prisma.auditPlanEntry.findUnique({ where: { id } })
    check("1c) entry actually removed from DB", stillThere === null)
    createdEntryIds.splice(createdEntryIds.indexOf(id), 1) // zaten silindi, teardown'da tekrar denemesin
  }

  // --- 2) En az bir AuditSessionItem.result dolu → 409 checklist_answer_exists ---
  // (Her senaryo kendi YENİ AuditSession'ını oluşturur, bu yüzden aynı checklistItemId'yi
  // farklı session'larda tekrar kullanmak (auditSessionId, auditChecklistItemId) unique
  // constraint'ine takılmaz.)
  {
    const id = await createSafeShellEntry()
    const session = await prisma.auditSession.create({
      data: { auditPlanEntryId: id, auditChecklistId: checklistId, status: "InProgress" },
    })
    await prisma.auditSessionItem.create({
      data: { auditSessionId: session.id, auditChecklistItemId: checklistItemId, result: "S", notes: null },
    })

    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check(
      "2) result dolu → deletable:false, reasons içinde checklist_answer_exists",
      decision.deletable === false && decision.status === 409 && !!decision.reasons?.includes("checklist_answer_exists"),
      decision
    )
  }

  // --- 3) En az bir AuditSessionItem.notes dolu (result null) → 409 checklist_answer_exists ---
  {
    const id = await createSafeShellEntry()
    const session = await prisma.auditSession.create({
      data: { auditPlanEntryId: id, auditChecklistId: checklistId, status: "InProgress" },
    })
    await prisma.auditSessionItem.create({
      data: { auditSessionId: session.id, auditChecklistItemId: checklistItemId, result: null, notes: "auditor note" },
    })

    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check(
      "3) notes dolu (result null) → deletable:false, reasons içinde checklist_answer_exists",
      decision.deletable === false && decision.status === 409 && !!decision.reasons?.includes("checklist_answer_exists"),
      decision
    )
  }

  // --- 4) AuditFinding var → 409 finding_exists ---
  {
    const id = await createSafeShellEntry()
    await prisma.auditFinding.create({
      data: {
        findingCode: `SMOKE-DEL-${Date.now()}`,
        auditPlanEntryId: id,
        explanation: "__SMOKE_TEST_DELETION__ manual finding",
        status: "Open",
      },
    })

    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check(
      "4) finding var → deletable:false, reasons içinde finding_exists",
      decision.deletable === false && decision.status === 409 && !!decision.reasons?.includes("finding_exists"),
      decision
    )
  }

  // --- 5) Aktif (revokedAt: null) AuditResponseLink var → 409 active_response_link_exists ---
  {
    const id = await createEntry()
    await prisma.auditResponseLink.create({
      data: { auditPlanEntryId: id, token: randomToken(), revokedAt: null },
    })

    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check(
      "5) aktif response link → deletable:false, reasons içinde active_response_link_exists",
      decision.deletable === false && decision.status === 409 && !!decision.reasons?.includes("active_response_link_exists"),
      decision
    )
  }

  // --- Bonus 5b/5c) Gerçek veri korumaları — Audit File / Auditee Note ---
  {
    const id = await createEntry()
    await prisma.auditPlanDocument.create({
      data: { auditPlanEntryId: id, fileName: "smoke.pdf", storagePath: "__smoke_test_deletion__/never-uploaded.pdf" },
    })
    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check(
      "5b) audit file var → deletable:false, reasons içinde audit_file_exists",
      decision.deletable === false && decision.status === 409 && !!decision.reasons?.includes("audit_file_exists"),
      decision
    )
  }
  {
    const id = await createEntry()
    await prisma.auditResponseNote.create({ data: { auditPlanEntryId: id, note: "__SMOKE_TEST_DELETION__ note" } })
    const decision = await checkAuditPlanEntryDeletable(prisma, id)
    check(
      "5c) auditee note var → deletable:false, reasons içinde auditee_note_exists",
      decision.deletable === false && decision.status === 409 && !!decision.reasons?.includes("auditee_note_exists"),
      decision
    )
  }

  // --- 6) Storage attachment'lı silinebilir audit → storage temizlenir, sonra DB cascade ile silinir ---
  {
    const id = await createSafeShellEntry()
    const session = await prisma.auditSession.findFirstOrThrow({ where: { auditPlanEntryId: id } })
    const sessionItem = await prisma.auditSessionItem.findFirstOrThrow({ where: { auditSessionId: session.id } })
    const submission = await prisma.auditeeChecklistSubmission.findFirstOrThrow({
      where: { auditSessionItemId: sessionItem.id },
    })

    const dummyBuffer = Buffer.from("smoke test attachment content")
    const attachmentUpload = await uploadBinaryToStorage(
      `__smoke_test_deletion__/${id}`,
      "session-item-attachment.txt",
      dummyBuffer,
      "text/plain"
    )
    const submissionUpload = await uploadBinaryToStorage(
      `__smoke_test_deletion__/${id}`,
      "submission-file.txt",
      dummyBuffer,
      "text/plain"
    )
    check("6a) test dosyaları Storage'a yüklendi", attachmentUpload.ok === true && submissionUpload.ok === true, {
      attachmentUpload,
      submissionUpload,
    })
    if (!attachmentUpload.ok || !submissionUpload.ok) {
      throw new Error("Storage setup failed for scenario 6 — aborting.")
    }

    await prisma.auditSessionItemAttachment.create({
      data: {
        auditSessionItemId: sessionItem.id,
        fileName: "session-item-attachment.txt",
        storagePath: attachmentUpload.path,
      },
    })
    await prisma.auditeeChecklistSubmissionFile.create({
      data: {
        submissionId: submission.id,
        fileName: "submission-file.txt",
        storagePath: submissionUpload.path,
      },
    })

    const result = await deleteAuditPlanEntryIfSafe(prisma, id)
    check("6b) storage'lı silinebilir audit: deleteAuditPlanEntryIfSafe → ok:true", result.ok === true, result)

    const entryGone = await prisma.auditPlanEntry.findUnique({ where: { id } })
    check("6c) entry DB cascade ile silindi", entryGone === null)

    const attachmentStillInStorage = await downloadPdfFromStorage(attachmentUpload.path)
    const submissionFileStillInStorage = await downloadPdfFromStorage(submissionUpload.path)
    check("6d) session item attachment Storage'dan temizlendi (orphan yok)", attachmentStillInStorage === null)
    check("6e) submission file Storage'dan temizlendi (orphan yok)", submissionFileStillInStorage === null)

    createdEntryIds.splice(createdEntryIds.indexOf(id), 1) // zaten silindi
  }

  // --- Bonus 7) Storage silme başarısız olursa DB kaydı silinmez VE db.auditPlanEntry.delete()
  // hiç ÇAĞRILMAZ (orphan/partial deletion önlenir; ayrıca storage-fail → DB-delete-not-called
  // garantisi tam olarak istenen 4. senaryo) ---
  {
    const id = await createSafeShellEntry()
    const session = await prisma.auditSession.findFirstOrThrow({ where: { auditPlanEntryId: id } })
    const sessionItem = await prisma.auditSessionItem.findFirstOrThrow({ where: { auditSessionId: session.id } })
    await prisma.auditSessionItemAttachment.create({
      data: {
        auditSessionItemId: sessionItem.id,
        fileName: "will-fail-to-delete.txt",
        storagePath: "__smoke_test_deletion__/never-uploaded-on-purpose.txt",
      },
    })

    let deleteEntryCallCount = 0
    const trackedDeleteEntry = async (entryId: number) => {
      deleteEntryCallCount++
      await prisma.auditPlanEntry.delete({ where: { id: entryId } })
    }

    const result = await deleteAuditPlanEntryIfSafe(prisma, id, {
      deleteStorageFile: async () => false,
      deleteEntry: trackedDeleteEntry,
    })
    check("7a) storage silme başarısız → ok:false, status:500", result.ok === false && result.status === 500, result)

    const stillThere = await prisma.auditPlanEntry.findUnique({ where: { id } })
    check("7b) storage silme başarısız olunca DB kaydı SİLİNMEDİ (partial deletion yok)", stillThere !== null)
    check("7c) storage başarısız → db.auditPlanEntry.delete() HİÇ ÇAĞRILMADI", deleteEntryCallCount === 0, {
      deleteEntryCallCount,
    })
  }

  // --- 8) DB delete: ilk deneme geçici hata, ikinci deneme başarılı → ok:true (retry çalışıyor) ---
  {
    const id = await createSafeShellEntry()
    let attempts = 0
    const flakyThenSucceedDeleteEntry = async (entryId: number) => {
      attempts++
      if (attempts === 1) {
        throw new Error("simulated transient DB connection error")
      }
      await prisma.auditPlanEntry.delete({ where: { id: entryId } })
    }

    const startedAt = Date.now()
    const result = await deleteAuditPlanEntryIfSafe(prisma, id, { deleteEntry: flakyThenSucceedDeleteEntry })
    const elapsedMs = Date.now() - startedAt

    check("8a) ilk deneme hata, ikinci başarılı → ok:true", result.ok === true, result)
    check("8b) tam olarak 2 deneme yapıldı", attempts === 2, { attempts })
    check("8c) ilk retry backoff'u (~300ms) gerçekten beklendi", elapsedMs >= 250, { elapsedMs })

    const stillThere = await prisma.auditPlanEntry.findUnique({ where: { id } })
    check("8d) entry gerçekten silindi", stillThere === null)
    createdEntryIds.splice(createdEntryIds.indexOf(id), 1) // zaten silindi
  }

  // --- 9) DB delete: 3 deneme de başarısız → ok:false, status:500 ---
  {
    const id = await createSafeShellEntry()
    let attempts = 0
    const alwaysFailDeleteEntry = async () => {
      attempts++
      throw new Error("simulated persistent DB connection error")
    }

    const result = await deleteAuditPlanEntryIfSafe(prisma, id, { deleteEntry: alwaysFailDeleteEntry })
    check("9a) 3 deneme de başarısız → ok:false, status:500", result.ok === false && result.status === 500, result)
    check("9b) tam olarak 3 deneme yapıldı", attempts === 3, { attempts })

    const stillThere = await prisma.auditPlanEntry.findUnique({ where: { id } })
    check("9c) tüm denemeler başarısız olunca DB kaydı SİLİNMEDİ", stillThere !== null)
    // id createdEntryIds'te kaldı — teardown gerçek prisma.auditPlanEntry.delete ile temizleyecek.
  }

  // --- 10) DB delete: P2025 (kayıt zaten yok) → YENİDEN DENENMEZ, doğrudan 404 ---
  {
    const id = await createSafeShellEntry()
    let attempts = 0
    const notFoundDeleteEntry = async () => {
      attempts++
      throw new Prisma.PrismaClientKnownRequestError("An operation failed because it depends on one or more records that were required but not found.", {
        code: "P2025",
        clientVersion: "smoke-test",
      })
    }

    const result = await deleteAuditPlanEntryIfSafe(prisma, id, { deleteEntry: notFoundDeleteEntry })
    check("10a) P2025 → ok:false, status:404", result.ok === false && result.status === 404, result)
    check("10b) P2025 sonrası YENİDEN DENENMEDİ (tam olarak 1 deneme)", attempts === 1, { attempts })

    const stillThere = await prisma.auditPlanEntry.findUnique({ where: { id } })
    check("10c) entry gerçekte hâlâ DB'de (P2025 simüle edildi, gerçekte silinmedi)", stillThere !== null)
    // id createdEntryIds'te kaldı — teardown gerçek prisma.auditPlanEntry.delete ile temizleyecek.
  }

  await teardownFixtures()

  const remaining = await prisma.auditPlanEntry.count({ where: { auditCategoryTypeId: categoryId } }).catch(() => 0)
  check("teardown: hiçbir smoke-test entry'si kalmadı", remaining === 0, { remaining })

  if (failed > 0) {
    console.error(`\n${failed} case(s) FAILED`)
    process.exitCode = 1
  } else {
    console.log("\nAll smoke-test cases passed, no residual test data left in DB or Storage.")
  }
}

main()
  .catch(async (e) => {
    console.error("SMOKE TEST CRASHED:", e)
    try {
      await teardownFixtures()
    } catch {
      /* best-effort cleanup */
    }
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import "server-only"

import { prisma } from "@/lib/prisma-server"
import { uploadBinaryToStorage } from "@/lib/supabase-storage"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { extractTextFromPdfBuffer } from "@/lib/extract-pdf-text"
import {
  SHGM_CATEGORY_LABELS,
  SHGM_SUB_PAGES,
  getShgmRegulationType,
  type ShgmCategoryKey,
} from "@/lib/shgm/categories"
import { scrapeShgmSubPage, type ShgmScrapedRow } from "@/lib/shgm/scrape"
import { summarizeShgmRegulation } from "@/lib/shgm/summarize"
import { sendShgmRegulationNotification, type ShgmNotifyItem } from "@/lib/shgm/notify"

const PDF_MAX_BYTES = 30 * 1024 * 1024
const PDF_FETCH_TIMEOUT_MS = 6_000

/** Bir sync koşusunda eski birikmiş (backfill öncesi) unsent kayıtları da denerken sınır — tek koşuda mail selini önler. */
const MAX_RETRY_UNSENT_PER_RUN = 20

function buildSourceKey(category: ShgmCategoryKey, title: string): string {
  return `${category}::${slugifyManualTitle(title)}`.slice(0, 300)
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}

async function downloadPdfBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const isLikelyPdf = /\.pdf(\?|#|$)/i.test(url)
  if (!isLikelyPdf) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 BonjourMevzuatTakip/1.0" },
    })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") || "application/pdf"
    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > PDF_MAX_BYTES) return null
    return { buffer: Buffer.from(arrayBuffer), contentType }
  } catch (e) {
    console.error(`[shgm-sync] PDF download failed for ${url}:`, e)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

type DetectedItem = {
  kind: "created" | "revised"
  regulationId: number
  revisionId: number
  title: string
  category: ShgmCategoryKey
  department: string | null
  sourceUrl: string
  publishDate: Date | null
  revisionNo: string | null
  revisionDate: Date | null
  previousRevisionNo: string | null
  previousRevisionDate: Date | null
  detectedAt: Date
}

export type ShgmSyncSummary = {
  scannedSubPages: number
  scrapeErrors: { url: string; error: string }[]
  totalRowsSeen: number
  created: number
  revised: number
  emailDelivery: { attempted: number; sent: number; failed: number; skipped: boolean } | null
}

/**
 * Kısa AI özeti üretip kaydeder — best-effort: PDF metni çıkarılamazsa veya
 * Groq çağrısı başarısız olursa sadece loglar, senkronizasyonu bloklamaz.
 */
async function generateAndStoreSummary(
  regulationId: number,
  title: string,
  category: ShgmCategoryKey,
  pdf: { buffer: Buffer; contentType: string } | null
): Promise<void> {
  try {
    let pdfText: string | null = null
    if (pdf) {
      try {
        const extracted = await extractTextFromPdfBuffer(pdf.buffer)
        pdfText = extracted.text
      } catch (e) {
        console.error(`[shgm-sync] PDF text extraction failed for regulation ${regulationId}:`, e)
      }
    }

    const summary = await summarizeShgmRegulation({
      title,
      categoryLabel: SHGM_CATEGORY_LABELS[category] ?? category,
      pdfText,
    })
    if (!summary) return

    await prisma.shgmRegulation.update({
      where: { id: regulationId },
      data: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
    })
  } catch (e) {
    console.error(`[shgm-sync] summary generation failed for regulation ${regulationId}:`, e)
  }
}

/** Aynı sourceKey birden çok alt sayfada görülürse en son taranan kazanır. */
function dedupeRows(allRows: ShgmScrapedRow[]): Map<string, ShgmScrapedRow> {
  const map = new Map<string, ShgmScrapedRow>()
  for (const row of allRows) {
    map.set(buildSourceKey(row.category, row.title), row)
  }
  return map
}

export async function runShgmMevzuatSync(): Promise<ShgmSyncSummary> {
  const scrapeErrors: { url: string; error: string }[] = []
  const allRows: ShgmScrapedRow[] = []

  for (const subPage of SHGM_SUB_PAGES) {
    const result = await scrapeShgmSubPage(subPage)
    if (result.error) scrapeErrors.push({ url: subPage.url, error: result.error })
    allRows.push(...result.rows)
  }

  const rowsByKey = dedupeRows(allRows)
  const sourceKeys = [...rowsByKey.keys()]

  const existing = await prisma.shgmRegulation.findMany({
    where: { sourceKey: { in: sourceKeys } },
  })
  const existingByKey = new Map(existing.map((r) => [r.sourceKey, r]))

  const defaults = await prisma.shgmCategoryDefaultDepartment.findMany()
  const defaultDeptByCategory = new Map(defaults.map((d) => [d.category, d.department]))

  const detected: DetectedItem[] = []

  for (const [sourceKey, row] of rowsByKey) {
    const existingRow = existingByKey.get(sourceKey)

    if (!existingRow) {
      let created
      try {
        created = await prisma.shgmRegulation.create({
          data: {
            title: row.title,
            category: row.category,
            sourceUrl: row.sourceUrl,
            sourceKey,
            department: defaultDeptByCategory.get(row.category) ?? null,
            status: "new",
            publishDate: row.publishDate,
            latestRevisionNo: row.revisionNo,
            latestRevisionDate: row.revisionDate,
            latestRawFingerprint: row.rawFingerprint,
          },
        })
      } catch (e) {
        // Eşzamanlı bir çalıştırma (ör. cron + manuel tarama) aynı yeni kaydı oluşturmuş olabilir.
        const isUniqueViolation =
          typeof e === "object" && e !== null && "code" in e && e.code === "P2002"
        if (isUniqueViolation) continue
        throw e
      }

      const pdf = row.pdfUrl ? await downloadPdfBuffer(row.pdfUrl) : null
      let pdfStoragePath: string | null = null
      let pdfFileName: string | null = null
      if (pdf) {
        const fileName = `${created.id}-${Date.now()}.pdf`
        const upload = await uploadBinaryToStorage(
          `shgm-mevzuat/${created.id}`,
          fileName,
          pdf.buffer,
          pdf.contentType
        )
        if (upload.ok) {
          pdfStoragePath = upload.path
          pdfFileName = upload.fileName
        }
      }

      const revision = await prisma.shgmRegulationRevision.create({
        data: {
          regulationId: created.id,
          kind: "created",
          revisionNo: row.revisionNo,
          revisionDate: row.revisionDate,
          pdfStoragePath,
          pdfFileName,
          sourceUrl: row.sourceUrl,
        },
      })

      await generateAndStoreSummary(created.id, row.title, row.category, pdf)

      detected.push({
        kind: "created",
        regulationId: created.id,
        revisionId: revision.id,
        title: row.title,
        category: row.category,
        department: created.department,
        sourceUrl: row.sourceUrl,
        publishDate: row.publishDate,
        revisionNo: row.revisionNo,
        revisionDate: row.revisionDate,
        previousRevisionNo: null,
        previousRevisionDate: null,
        detectedAt: revision.detectedAt,
      })
      continue
    }

    const changed =
      existingRow.latestRevisionNo !== row.revisionNo ||
      !sameDay(existingRow.latestRevisionDate, row.revisionDate) ||
      existingRow.latestRawFingerprint !== row.rawFingerprint

    if (!changed) continue

    const pdf = row.pdfUrl ? await downloadPdfBuffer(row.pdfUrl) : null
    let pdfStoragePath: string | null = null
    let pdfFileName: string | null = null
    if (pdf) {
      const fileName = `${existingRow.id}-${Date.now()}.pdf`
      const upload = await uploadBinaryToStorage(
        `shgm-mevzuat/${existingRow.id}`,
        fileName,
        pdf.buffer,
        pdf.contentType
      )
      if (upload.ok) {
        pdfStoragePath = upload.path
        pdfFileName = upload.fileName
      }
    }

    const revision = await prisma.shgmRegulationRevision.create({
      data: {
        regulationId: existingRow.id,
        kind: "revised",
        revisionNo: row.revisionNo,
        revisionDate: row.revisionDate,
        pdfStoragePath,
        pdfFileName,
        sourceUrl: row.sourceUrl,
      },
    })

    await prisma.shgmRegulation.update({
      where: { id: existingRow.id },
      data: {
        status: "new",
        latestRevisionNo: row.revisionNo,
        latestRevisionDate: row.revisionDate,
        latestRawFingerprint: row.rawFingerprint,
        publishDate: row.publishDate ?? existingRow.publishDate,
      },
    })

    // Revizyon geldi — özeti de güncel içerikle yenile (varsa yeni PDF ile).
    await generateAndStoreSummary(existingRow.id, row.title, row.category, pdf)

    detected.push({
      kind: "revised",
      regulationId: existingRow.id,
      revisionId: revision.id,
      title: row.title,
      category: row.category,
      department: existingRow.department,
      sourceUrl: row.sourceUrl,
      publishDate: row.publishDate ?? existingRow.publishDate,
      revisionNo: row.revisionNo,
      revisionDate: row.revisionDate,
      previousRevisionNo: existingRow.latestRevisionNo,
      previousRevisionDate: existingRow.latestRevisionDate,
      detectedAt: revision.detectedAt,
    })
  }

  // Mail gönderimi tarama sonucunu asla bozmamalı — her adım kendi içinde yutulur.
  const emailDelivery = await notifyAllPending(detected)

  return {
    scannedSubPages: SHGM_SUB_PAGES.length,
    scrapeErrors,
    totalRowsSeen: rowsByKey.size,
    created: detected.filter((d) => d.kind === "created").length,
    revised: detected.filter((d) => d.kind === "revised").length,
    emailDelivery,
  }
}

/**
 * Bu koşuda tespit edilen NEW/REVISED olayları için mevzuat başına tek bildirim
 * gönderir, ardından önceki koşulardan kalmış (ör. Resend o an erişilemezdi)
 * `emailSentAt IS NULL` revizyonları da sınırlı sayıda yeniden dener.
 *
 * emailSentAt yalnızca gönderim GERÇEKTEN başarılıysa işaretlenir — böylece
 * başarısız gönderimler bir sonraki taramada otomatik retry edilir ve aynı
 * mevzuat+revizyon için asla iki kez başarılı mail gitmez (revision satırı
 * zaten olay başına tekil olduğundan doğal dedup sağlanır).
 */
async function notifyAllPending(
  detected: DetectedItem[]
): Promise<ShgmSyncSummary["emailDelivery"]> {
  let attempted = 0
  let sent = 0
  let failed = 0
  let anySkipped = false

  for (const item of detected) {
    const result = await trySendAndMark({
      kind: item.kind,
      regulationId: item.regulationId,
      revisionId: item.revisionId,
      title: item.title,
      typeLabel: getShgmRegulationType(item.category, item.sourceUrl).label,
      department: item.department,
      sourceUrl: item.sourceUrl,
      publishDate: item.publishDate,
      revisionNo: item.revisionNo,
      revisionDate: item.revisionDate,
      previousRevisionNo: item.previousRevisionNo,
      previousRevisionDate: item.previousRevisionDate,
      detectedAt: item.detectedAt,
    })
    attempted += 1
    if (result === "sent") sent += 1
    else if (result === "failed") failed += 1
    else anySkipped = true
  }

  // Bu koşuda tespit edilenler dışında, daha önce gönderilememiş eski kayıtları da dene.
  try {
    const alreadyHandled = new Set(detected.map((d) => d.revisionId))
    const unsent = await prisma.shgmRegulationRevision.findMany({
      where: { emailSentAt: null, kind: { in: ["created", "revised"] } },
      orderBy: { detectedAt: "asc" },
      take: MAX_RETRY_UNSENT_PER_RUN + alreadyHandled.size,
      include: { regulation: true },
    })

    for (const rev of unsent) {
      if (alreadyHandled.has(rev.id)) continue
      if (attempted - detected.length >= MAX_RETRY_UNSENT_PER_RUN) break

      let previousRevisionNo: string | null = null
      let previousRevisionDate: Date | null = null
      if (rev.kind === "revised") {
        const prior = await prisma.shgmRegulationRevision.findFirst({
          where: { regulationId: rev.regulationId, detectedAt: { lt: rev.detectedAt } },
          orderBy: { detectedAt: "desc" },
        })
        previousRevisionNo = prior?.revisionNo ?? null
        previousRevisionDate = prior?.revisionDate ?? null
      }

      const result = await trySendAndMark({
        kind: rev.kind === "revised" ? "revised" : "created",
        regulationId: rev.regulationId,
        revisionId: rev.id,
        title: rev.regulation.title,
        typeLabel: getShgmRegulationType(rev.regulation.category, rev.sourceUrl).label,
        department: rev.regulation.department,
        sourceUrl: rev.sourceUrl,
        publishDate: rev.regulation.publishDate,
        revisionNo: rev.revisionNo,
        revisionDate: rev.revisionDate,
        previousRevisionNo,
        previousRevisionDate,
        detectedAt: rev.detectedAt,
      })
      attempted += 1
      if (result === "sent") sent += 1
      else if (result === "failed") failed += 1
      else anySkipped = true
    }
  } catch (e) {
    console.error("[shgm-sync] unsent-notification retry failed:", e)
  }

  if (attempted === 0) return null
  return { attempted, sent, failed, skipped: anySkipped }
}

/** Tek bir olay için mail gönderir; yalnızca gerçek başarıda emailSentAt işaretler. Asla throw etmez. */
async function trySendAndMark(
  item: ShgmNotifyItem & { revisionId: number }
): Promise<"sent" | "failed" | "skipped"> {
  try {
    const result = await sendShgmRegulationNotification(item)
    if ("skipped" in result) {
      console.warn(`[shgm-sync] notification skipped for revision ${item.revisionId}:`, result.reason)
      return "skipped"
    }
    if (result.sent) {
      await prisma.shgmRegulationRevision.update({
        where: { id: item.revisionId },
        data: { emailSentAt: new Date() },
      })
      return "sent"
    }
    console.error(`[shgm-sync] notification failed for revision ${item.revisionId}:`, result.error)
    return "failed"
  } catch (e) {
    console.error(`[shgm-sync] notification threw for revision ${item.revisionId}:`, e)
    return "failed"
  }
}

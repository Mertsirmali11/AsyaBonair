import "server-only"

import { prisma } from "@/lib/prisma-server"
import { uploadBinaryToStorage } from "@/lib/supabase-storage"
import { slugifyManualTitle } from "@/lib/company-manual-slug"
import { getAppPublicUrl } from "@/lib/app-public-url"
import { escapeHtml, getResend, sendHtmlEmail } from "@/lib/mail"
import {
  SHGM_CATEGORY_LABELS,
  SHGM_SUB_PAGES,
  type ShgmCategoryKey,
} from "@/lib/shgm/categories"
import { scrapeShgmSubPage, type ShgmScrapedRow } from "@/lib/shgm/scrape"

const PDF_MAX_BYTES = 30 * 1024 * 1024
const PDF_FETCH_TIMEOUT_MS = 6_000

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
  revisionNo: string | null
  revisionDate: Date | null
  sourceUrl: string
}

export type ShgmSyncSummary = {
  scannedSubPages: number
  scrapeErrors: { url: string; error: string }[]
  totalRowsSeen: number
  created: number
  revised: number
  emailDelivery:
    | { skipped: true; reason: string }
    | { sent: number; failed: number; errors: string[] }
    | null
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

      detected.push({
        kind: "created",
        regulationId: created.id,
        revisionId: revision.id,
        title: row.title,
        category: row.category,
        revisionNo: row.revisionNo,
        revisionDate: row.revisionDate,
        sourceUrl: row.sourceUrl,
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

    detected.push({
      kind: "revised",
      regulationId: existingRow.id,
      revisionId: revision.id,
      title: row.title,
      category: row.category,
      revisionNo: row.revisionNo,
      revisionDate: row.revisionDate,
      sourceUrl: row.sourceUrl,
    })
  }

  const emailDelivery = await notifyDetectedItems(detected)

  return {
    scannedSubPages: SHGM_SUB_PAGES.length,
    scrapeErrors,
    totalRowsSeen: rowsByKey.size,
    created: detected.filter((d) => d.kind === "created").length,
    revised: detected.filter((d) => d.kind === "revised").length,
    emailDelivery,
  }
}

async function notifyDetectedItems(
  items: DetectedItem[]
): Promise<ShgmSyncSummary["emailDelivery"]> {
  if (items.length === 0) return null

  const notifyEmail = process.env.SHGM_MEVZUAT_NOTIFY_EMAIL?.trim()
  if (!notifyEmail) {
    console.warn(
      "[shgm-sync] SHGM_MEVZUAT_NOTIFY_EMAIL not configured — skipping notification email."
    )
    return { skipped: true, reason: "SHGM_MEVZUAT_NOTIFY_EMAIL not configured" }
  }

  const base = getAppPublicUrl()
  const rows = items
    .map((item) => {
      const detailLink = base ? `${base}/compliance/shgm-mevzuat/${item.regulationId}` : ""
      const kindLabel = item.kind === "created" ? "Yeni mevzuat" : "Revizyon"
      const revisionInfo = [
        item.revisionNo ? `No: ${escapeHtml(item.revisionNo)}` : null,
        item.revisionDate
          ? `Tarih: ${item.revisionDate.toLocaleDateString("tr-TR")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${escapeHtml(kindLabel)}</strong></td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(SHGM_CATEGORY_LABELS[item.category])}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(item.title)}${revisionInfo ? `<br /><small>${escapeHtml(revisionInfo)}</small>` : ""}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            <a href="${escapeHtml(item.sourceUrl)}">SHGM</a>${detailLink ? ` · <a href="${escapeHtml(detailLink)}">Detay</a>` : ""}
          </td>
        </tr>`
    })
    .join("")

  const html = `
    <h2>SHGM Mevzuat Güncellemeleri</h2>
    <p>${items.length} kayıt tespit edildi (yeni yayım veya revizyon).</p>
    <table style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ccc;">Tür</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ccc;">Kategori</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ccc;">Mevzuat</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ccc;">Bağlantı</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr />
    <small>Bonjour portalı SHGM Mevzuat takip sistemi tarafından otomatik gönderilmiştir.</small>
  `

  const resend = getResend()
  const result = await sendHtmlEmail(
    resend,
    [notifyEmail],
    `SHGM Mevzuat Güncellemesi — ${items.length} kayıt`,
    html,
    "shgm-sync"
  )

  if (!("skipped" in result) || !result.skipped) {
    await prisma.shgmRegulationRevision.updateMany({
      where: { id: { in: items.map((i) => i.revisionId) } },
      data: { emailSentAt: new Date() },
    })
  }

  return result
}

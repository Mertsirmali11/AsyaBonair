import * as cheerio from "cheerio"

import type { ShgmSubPage } from "@/lib/shgm/categories"

export type ShgmScrapedRow = {
  category: ShgmSubPage["category"]
  subPageLabel: string
  sourceUrl: string
  title: string
  pdfUrl: string | null
  publishDate: Date | null
  revisionDate: Date | null
  revisionNo: string | null
  /** Başlık dışındaki tüm hücrelerin ham metni — kolon anlamı yakalanamasa da değişiklik tespiti için. */
  rawFingerprint: string
}

export type ShgmScrapeResult = {
  subPage: ShgmSubPage
  rows: ShgmScrapedRow[]
  error: string | null
}

const FETCH_TIMEOUT_MS = 20_000
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BonjourMevzuatTakip/1.0"

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function normalizeHeader(s: string): string {
  return normalizeWhitespace(s)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
}

/** "12/03/2024" → Date; "–", "-", boş → null */
function parseShgmDate(raw: string): Date | null {
  const s = normalizeWhitespace(raw).replace(/[‐-―]/g, "-")
  if (!s || s === "-") return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
  return Number.isNaN(date.getTime()) ? null : date
}

function parseRevisionNo(raw: string): string | null {
  const s = normalizeWhitespace(raw).replace(/[‐-―]/g, "-")
  if (!s || s === "-") return null
  return s
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

type ColumnLayout = {
  titleIndex: number
  publishDateIndex: number | null
  revisionDateIndex: number | null
  revisionNoIndex: number | null
}

/**
 * mevzuat.shgm.gov.tr'deki tablo şeması kategoriden kategoriye değişiyor
 * (2 ila 6 kolon, kolon sırası farklı). Kolon indekslerini sabit varsaymak yerine
 * `<thead><th>` metinlerinden anlamlarını çıkarıyoruz.
 */
function resolveColumnLayout(headers: string[]): ColumnLayout {
  const norm = headers.map(normalizeHeader)

  const titleIndex = norm.findIndex((h) => h.includes("ad"))
  const revisionDateIndex = norm.findIndex(
    (h) => (h.includes("degisiklik") || h.includes("revizyon")) && h.includes("tarih")
  )
  const revisionNoIndex = norm.findIndex(
    (h) =>
      (h.includes("degisiklik") || h.includes("revizyon")) &&
      (h.includes("no") || h.includes("sayi"))
  )
  const publishDateIndex = norm.findIndex(
    (h) =>
      (h.includes("yayim") || h.includes("yayin") || h.includes("yururluk")) &&
      h.includes("tarih")
  )
  // Tek "Tarih(i)" kolonu olan (2-3 kolonluk) sayfalarda revizyon tarihi olarak kabul et.
  const fallbackDateIndex =
    revisionDateIndex === -1 && publishDateIndex === -1
      ? norm.findIndex((h) => h.includes("tarih"))
      : -1

  return {
    titleIndex: titleIndex === -1 ? 0 : titleIndex,
    publishDateIndex: publishDateIndex === -1 ? null : publishDateIndex,
    revisionDateIndex:
      revisionDateIndex !== -1 ? revisionDateIndex : fallbackDateIndex !== -1 ? fallbackDateIndex : null,
    revisionNoIndex: revisionNoIndex === -1 ? null : revisionNoIndex,
  }
}

export function parseShgmCategoryPage(
  html: string,
  subPage: ShgmSubPage
): { rows: ShgmScrapedRow[]; tableFound: boolean } {
  const $ = cheerio.load(html)
  const table = $("table#searchTable").first()
  if (table.length === 0) return { rows: [], tableFound: false }

  const headers = table
    .find("thead th")
    .map((_, th) => $(th).text())
    .get()
  const layout = resolveColumnLayout(headers)

  const rows: ShgmScrapedRow[] = []

  table.find("tbody tr").each((_, el) => {
    const cells = $(el).find("td")
    if (cells.length < 1) return

    const titleCell = cells.eq(Math.min(layout.titleIndex, cells.length - 1))
    const link = titleCell.find("a").first()
    const title = normalizeWhitespace(link.length ? link.text() : titleCell.text())
    if (!title) return

    const href = link.attr("href")?.trim() || null
    const pdfUrl = href ? new URL(href, subPage.url).toString() : null

    const publishDate =
      layout.publishDateIndex !== null && cells.length > layout.publishDateIndex
        ? parseShgmDate(cells.eq(layout.publishDateIndex).text())
        : null
    const revisionDate =
      layout.revisionDateIndex !== null && cells.length > layout.revisionDateIndex
        ? parseShgmDate(cells.eq(layout.revisionDateIndex).text())
        : null
    const revisionNo =
      layout.revisionNoIndex !== null && cells.length > layout.revisionNoIndex
        ? parseRevisionNo(cells.eq(layout.revisionNoIndex).text())
        : null

    const rawFingerprint = cells
      .toArray()
      .filter((_, i) => i !== layout.titleIndex)
      .map((td) => normalizeWhitespace($(td).text()))
      .join("|")

    rows.push({
      category: subPage.category,
      subPageLabel: subPage.label,
      sourceUrl: subPage.url,
      title,
      pdfUrl,
      publishDate,
      revisionDate,
      revisionNo,
      rawFingerprint,
    })
  })

  return { rows, tableFound: true }
}

export async function scrapeShgmSubPage(subPage: ShgmSubPage): Promise<ShgmScrapeResult> {
  try {
    const html = await fetchHtml(subPage.url)
    const { rows, tableFound } = parseShgmCategoryPage(html, subPage)
    return {
      subPage,
      rows,
      error: tableFound ? null : "Sayfada mevzuat tablosu bulunamadı",
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[shgm-scrape] ${subPage.url} failed:`, message)
    return { subPage, rows: [], error: message }
  }
}

import "server-only"

import { escapeHtml, getResend, sendHtmlEmail } from "@/lib/mail"
import { getAppPublicUrl } from "@/lib/app-public-url"

/** SHGM mevzuat bildirimlerinin varsayılan alıcısı — env değişkeni tanımlıysa onu ezer. */
const DEFAULT_NOTIFY_EMAIL = "compliance@bonair.com.tr"

export function getShgmNotifyRecipients(): string[] {
  const configured = process.env.SHGM_MEVZUAT_NOTIFY_EMAIL?.trim()
  return [configured || DEFAULT_NOTIFY_EMAIL]
}

export type ShgmNotifyItem = {
  kind: "created" | "revised"
  regulationId: number
  title: string
  typeLabel: string
  department: string | null
  sourceUrl: string
  revisionNo: string | null
  revisionDate: Date | null
  publishDate: Date | null
  /** Yalnızca kind: "revised" için — değişiklik öncesi bilinen son revizyon bilgisi. */
  previousRevisionNo?: string | null
  previousRevisionDate?: Date | null
  detectedAt: Date
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("tr-TR") : "—"
}

function detailUrl(regulationId: number): string | null {
  const base = getAppPublicUrl()
  return base ? `${base}/compliance/shgm-mevzuat/${regulationId}` : null
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:13px;">${value}</td>
    </tr>`
}

function ctaButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 18px;background:#111827;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">${escapeHtml(label)}</a>`
}

function wrapEmail(heading: string, intro: string, rows: string, ctas: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px;">
      <h2 style="margin:0 0 8px;font-size:18px;">${escapeHtml(heading)}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">${escapeHtml(intro)}</p>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${rows}</table>
      <div>${ctas}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
      <small style="color:#9ca3af;">Bonjour SHGM Mevzuat takip sistemi tarafından otomatik gönderilmiştir.</small>
    </div>`
}

export function buildShgmNewPublicationEmail(item: ShgmNotifyItem): {
  subject: string
  html: string
} {
  const subject = `Yeni SHGM Mevzuatı Yayınlandı: ${item.title}`
  const rows =
    infoRow("Mevzuat Adı", escapeHtml(item.title)) +
    infoRow("Mevzuat Türü", escapeHtml(item.typeLabel)) +
    infoRow("Mevzuat No / Kod", escapeHtml(item.revisionNo ?? "—")) +
    infoRow("Yayım Tarihi", fmtDate(item.publishDate)) +
    (item.department ? infoRow("İlgili Departman", escapeHtml(item.department)) : "") +
    infoRow("Tespit Tarihi", fmtDate(item.detectedAt))

  const link = detailUrl(item.regulationId)
  const ctas =
    (link ? ctaButton(link, "Bonjour'da İncele") : "") +
    ctaButton(item.sourceUrl, "SHGM Kaynağını Aç")

  const html = wrapEmail(
    "Yeni SHGM Mevzuatı",
    "SHGM Mevzuat Portalı'nda yeni bir yayın tespit edilmiştir.",
    rows,
    ctas
  )
  return { subject, html }
}

export function buildShgmRevisionEmail(item: ShgmNotifyItem): { subject: string; html: string } {
  const subject = `SHGM Mevzuatı Revize Edildi: ${item.title}`
  const previous =
    item.previousRevisionNo || item.previousRevisionDate
      ? `${item.previousRevisionNo ?? "—"}${item.previousRevisionDate ? ` (${fmtDate(item.previousRevisionDate)})` : ""}`
      : null

  const rows =
    infoRow("Mevzuat Adı", escapeHtml(item.title)) +
    infoRow("Mevzuat Türü", escapeHtml(item.typeLabel)) +
    (previous ? infoRow("Eski Revizyon", escapeHtml(previous)) : "") +
    infoRow("Yeni Revizyon", escapeHtml(item.revisionNo ?? "—")) +
    infoRow("Revizyon Tarihi", fmtDate(item.revisionDate)) +
    (item.department ? infoRow("İlgili Departman", escapeHtml(item.department)) : "")

  const link = detailUrl(item.regulationId)
  const ctas =
    (link ? ctaButton(link, "Bonjour'da İncele") : "") +
    ctaButton(item.sourceUrl, "SHGM Kaynağını Aç")

  const html = wrapEmail(
    "SHGM Mevzuatı Revize Edildi",
    "Takip edilen bir SHGM mevzuatında yeni revizyon/değişiklik tespit edilmiştir.",
    rows,
    ctas
  )
  return { subject, html }
}

export type ShgmNotifySendResult =
  | { skipped: true; reason: string }
  | { sent: true }
  | { sent: false; error: string }

/**
 * Tek bir mevzuat olayı için bildirim e-postası gönderir — lib/mail.ts'teki
 * mevcut Resend altyapısını reuse eder, yeni bir mail sistemi kurmaz.
 */
export async function sendShgmRegulationNotification(
  item: ShgmNotifyItem
): Promise<ShgmNotifySendResult> {
  const resend = getResend()
  if (!resend) return { skipped: true, reason: "RESEND_API_KEY not configured" }

  const { subject, html } = item.kind === "created"
    ? buildShgmNewPublicationEmail(item)
    : buildShgmRevisionEmail(item)

  const recipients = getShgmNotifyRecipients()
  const result = await sendHtmlEmail(resend, recipients, subject, html, "shgm-notify")

  if ("skipped" in result) return result
  if (result.sent > 0 && result.failed === 0) return { sent: true }
  return { sent: false, error: result.errors.join("; ") || "Unknown send failure" }
}

import "server-only"

import { prisma } from "@/lib/prisma-server"
import { getResend, sendHtmlEmail, escapeHtml } from "@/lib/mail"
import { getAppPublicUrl } from "@/lib/app-public-url"

/**
 * CPA e-posta bildirimleri — mevcut Resend altyapısı (lib/mail.ts) reuse edilir, aynı desen
 * app/api/audit-findings/[id]/reminder/route.ts'te zaten kullanılıyor. Yeni bir bildirim
 * sistemi (in-app bell/model) KURULMUYOR — projede genel amaçlı böyle bir altyapı yok, mevcut
 * mail sistemi bunun yerine reuse ediliyor (bkz. analiz raporu H maddesi).
 */

function findingLink(findingId: number): string {
  const appUrl = getAppPublicUrl()
  return appUrl ? `${appUrl}/compliance/findings-follow-up/${findingId}` : `/compliance/findings-follow-up/${findingId}`
}

async function getFindingForEmail(findingId: number) {
  return prisma.auditFinding.findUnique({
    where: { id: findingId },
    select: {
      id: true,
      findingCode: true,
      assignedTo: { select: { id: true, isim: true, soyisim: true, email: true } },
      session: { select: { entry: { select: { auditors: { select: { calisan: { select: { email: true } } } } } } } },
      manualEntry: { select: { auditors: { select: { calisan: { select: { email: true } } } } } },
    },
  })
}

function auditorEmails(finding: Awaited<ReturnType<typeof getFindingForEmail>>): string[] {
  if (!finding) return []
  const entry = finding.session?.entry ?? finding.manualEntry ?? null
  const emails = (entry?.auditors ?? [])
    .map((a) => a.calisan.email)
    .filter((e): e is string => !!e?.trim())
  return Array.from(new Set(emails))
}

/** CPA ilk gönderildiğinde veya resubmit edildiğinde — bu denetimin auditor'larına bildirim. */
export async function notifyAuditorsCpaSubmitted(findingId: number, isResubmit: boolean): Promise<void> {
  const finding = await getFindingForEmail(findingId)
  if (!finding) return
  const emails = auditorEmails(finding)
  if (emails.length === 0) return

  const link = findingLink(findingId)
  const verb = isResubmit ? "yeniden gönderildi" : "gönderildi"
  const html = `
    <h2>📋 CPA Cevabı ${isResubmit ? "Yeniden " : ""}Gönderildi</h2>
    <p><strong>${escapeHtml(finding.findingCode)}</strong> bulgusuna sorumlu kişi tarafından CPA cevabı ${verb}. İncelemeniz bekleniyor.</p>
    <hr />
    <p>İncelemek için: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <small>Bon Air — Compliance Monitoring</small>
  `
  const resend = getResend()
  await sendHtmlEmail(
    resend,
    emails,
    `📋 CPA Response ${isResubmit ? "Resubmitted" : "Submitted"}: ${finding.findingCode} — Review Needed`,
    html,
    "audit-findings/cpa-submitted"
  )
}

/** Auditor "Düzenleme İste" dediğinde — sorumlu kişiye bildirim, revizyon notuyla. */
export async function notifyResponsibleCpaRevisionRequested(findingId: number, reviewNote: string): Promise<void> {
  const finding = await getFindingForEmail(findingId)
  const email = finding?.assignedTo?.email
  if (!finding || !email) return

  const link = findingLink(findingId)
  const html = `
    <h2>✏️ CPA Cevabınız İçin Düzenleme Talep Edildi</h2>
    <p><strong>${escapeHtml(finding.findingCode)}</strong> bulgusuna verdiğiniz CPA cevabı için düzenleme talep edildi.</p>
    <p><strong>Revizyon Notu:</strong> ${escapeHtml(reviewNote)}</p>
    <hr />
    <p>Cevabınızı güncellemek için: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <small>Bon Air — Compliance Monitoring</small>
  `
  const resend = getResend()
  await sendHtmlEmail(
    resend,
    [email],
    `✏️ Revision Requested: ${finding.findingCode}`,
    html,
    "audit-findings/cpa-revision-requested"
  )
}

/** Auditor "CPA'yı Kabul Et" dediğinde — sorumlu kişiye kısa kabul bildirimi. */
export async function notifyResponsibleCpaAccepted(findingId: number): Promise<void> {
  const finding = await getFindingForEmail(findingId)
  const email = finding?.assignedTo?.email
  if (!finding || !email) return

  const link = findingLink(findingId)
  const html = `
    <h2>✅ CPA Cevabınız Kabul Edildi</h2>
    <p><strong>${escapeHtml(finding.findingCode)}</strong> bulgusuna verdiğiniz CPA cevabı kabul edildi.</p>
    <hr />
    <p>Detaylar için: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <small>Bon Air — Compliance Monitoring</small>
  `
  const resend = getResend()
  await sendHtmlEmail(
    resend,
    [email],
    `✅ CPA Accepted: ${finding.findingCode}`,
    html,
    "audit-findings/cpa-accepted"
  )
}

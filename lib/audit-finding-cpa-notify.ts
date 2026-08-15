import "server-only"

import { prisma } from "@/lib/prisma-server"
import { getResend, sendHtmlEmail, escapeHtml } from "@/lib/mail"
import { getAppPublicUrl } from "@/lib/app-public-url"

/**
 * CPA e-posta bildirimleri — mevcut Resend altyapısı (lib/mail.ts) reuse edilir, aynı desen
 * app/api/audit-findings/[id]/reminder/route.ts'te zaten kullanılıyor. Yeni bir bildirim
 * sistemi (in-app bell/model) KURULMUYOR — projede genel amaçlı böyle bir altyapı yok, mevcut
 * mail sistemi bunun yerine reuse ediliyor.
 *
 * Kişiye atanmış bulgularda tek alıcı assignedTo; gruba atanmış bulgularda TÜM AKTİF
 * (istenCikisTarihi: null) grup üyeleri alıcı olur — mevcut reminder route'undaki
 * "departman fallback" ile aynı "aktif çalışan" filtresi (istenCikisTarihi: null).
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
      assignedGroup: {
        select: {
          id: true,
          name: true,
          members: {
            where: { calisan: { istenCikisTarihi: null } },
            select: { calisan: { select: { email: true } } },
          },
        },
      },
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

/** Kişiye atanmışsa [assignedTo.email], gruba atanmışsa grubun tüm AKTİF üyelerinin e-postaları. */
function responsiblePartyEmails(finding: Awaited<ReturnType<typeof getFindingForEmail>>): string[] {
  if (!finding) return []
  if (finding.assignedTo?.email) return [finding.assignedTo.email]
  if (finding.assignedGroup) {
    const emails = finding.assignedGroup.members
      .map((m) => m.calisan.email)
      .filter((e): e is string => !!e?.trim())
    return Array.from(new Set(emails))
  }
  return []
}

function calisanFullName(c: { isim: string | null; soyisim: string | null } | null | undefined): string {
  if (!c) return "Bilinmeyen kullanıcı"
  return [c.isim, c.soyisim].filter(Boolean).join(" ").trim() || "Bilinmeyen kullanıcı"
}

/**
 * CPA ilk gönderildiğinde veya resubmit edildiğinde — bu denetimin auditor'larına bildirim.
 * Gerçek cevabı gönderen kişi (respondedBy) e-postada AÇIKÇA belirtilir — grup ataması varken
 * "sorumlu kişi" ifadesi belirsiz kalmasın diye.
 */
export async function notifyAuditorsCpaSubmitted(
  findingId: number,
  isResubmit: boolean,
  responder: { isim: string | null; soyisim: string | null } | null
): Promise<void> {
  const finding = await getFindingForEmail(findingId)
  if (!finding) return
  const emails = auditorEmails(finding)
  if (emails.length === 0) return

  const link = findingLink(findingId)
  const verb = isResubmit ? "yeniden gönderildi" : "gönderildi"
  const responderName = calisanFullName(responder)
  const assignmentLine = finding.assignedGroup
    ? `Sorumlu Grup: ${escapeHtml(finding.assignedGroup.name)}`
    : `Sorumlu: ${escapeHtml(calisanFullName(finding.assignedTo))}`
  const html = `
    <h2>📋 CPA Cevabı ${isResubmit ? "Yeniden " : ""}Gönderildi</h2>
    <p><strong>${escapeHtml(finding.findingCode)}</strong> bulgusuna CPA cevabı ${verb}. İncelemeniz bekleniyor.</p>
    <p><strong>Cevabı Gönderen:</strong> ${escapeHtml(responderName)}</p>
    <p><strong>${assignmentLine}</strong></p>
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

/** Auditor "Düzenleme İste" dediğinde — sorumlu tarafa (kişi veya grubun tüm aktif üyelerine) bildirim. */
export async function notifyResponsibleCpaRevisionRequested(findingId: number, reviewNote: string): Promise<void> {
  const finding = await getFindingForEmail(findingId)
  if (!finding) return
  const emails = responsiblePartyEmails(finding)
  if (emails.length === 0) return

  const link = findingLink(findingId)
  const html = `
    <h2>✏️ CPA Cevabı İçin Düzenleme Talep Edildi</h2>
    <p><strong>${escapeHtml(finding.findingCode)}</strong> bulgusuna verilen CPA cevabı için düzenleme talep edildi.</p>
    <p><strong>Revizyon Notu:</strong> ${escapeHtml(reviewNote)}</p>
    <hr />
    <p>Cevabı güncellemek için: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <small>Bon Air — Compliance Monitoring</small>
  `
  const resend = getResend()
  await sendHtmlEmail(
    resend,
    emails,
    `✏️ Revision Requested: ${finding.findingCode}`,
    html,
    "audit-findings/cpa-revision-requested"
  )
}

/** Auditor "CPA'yı Kabul Et" dediğinde — sorumlu tarafa (kişi veya grubun tüm aktif üyelerine) kısa kabul bildirimi. */
export async function notifyResponsibleCpaAccepted(findingId: number): Promise<void> {
  const finding = await getFindingForEmail(findingId)
  if (!finding) return
  const emails = responsiblePartyEmails(finding)
  if (emails.length === 0) return

  const link = findingLink(findingId)
  const html = `
    <h2>✅ CPA Cevabı Kabul Edildi</h2>
    <p><strong>${escapeHtml(finding.findingCode)}</strong> bulgusuna verilen CPA cevabı kabul edildi.</p>
    <hr />
    <p>Detaylar için: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <small>Bon Air — Compliance Monitoring</small>
  `
  const resend = getResend()
  await sendHtmlEmail(
    resend,
    emails,
    `✅ CPA Accepted: ${finding.findingCode}`,
    html,
    "audit-findings/cpa-accepted"
  )
}

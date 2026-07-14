/** Ortak Resend gönderim yardımcıları — kalıp `app/api/announcements/route.ts`'ten çıkarılmıştır. */

export function getResend() {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require("resend") as typeof import("resend")
  return new Resend(key)
}

export function getMailFromAddress(): string {
  const from = process.env.RESEND_FROM?.trim()
  if (from) return from
  return "bonJour <onboarding@resend.dev>"
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type SendHtmlEmailResult =
  | { skipped: true; reason: string }
  | { sent: number; failed: number; errors: string[] }

/** Alıcılara tek tek gönderir (Resend'in tek istekte sınırlı alıcı sayısı için). */
export async function sendHtmlEmail(
  resend: ReturnType<typeof getResend>,
  emails: string[],
  subject: string,
  html: string,
  logTag: string
): Promise<SendHtmlEmailResult> {
  if (!resend) return { skipped: true, reason: "RESEND_API_KEY not configured" }
  if (emails.length === 0) return { skipped: true, reason: "No recipient emails" }

  const from = getMailFromAddress()
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const to of emails) {
    try {
      const { error } = await resend.emails.send({ from, to: [to], subject, html })
      if (error) {
        failed += 1
        const msg = `${to}: ${error.message}`
        errors.push(msg)
        console.error(`[${logTag}] Resend error:`, msg)
      } else {
        sent += 1
      }
    } catch (e) {
      failed += 1
      const msg = `${to}: ${e instanceof Error ? e.message : String(e)}`
      errors.push(msg)
      console.error(`[${logTag}] Send failed:`, msg)
    }
  }

  return { sent, failed, errors }
}

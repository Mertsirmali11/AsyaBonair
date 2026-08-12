import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma-server"

/** Denetimin bu durumlarındayken public response link kullanılamaz. */
const CLOSED_STATUSES = new Set(["Completed", "Cancelled"])

/** Tahmin edilemeyen, URL-safe, yüksek entropili token — Public Audit Response Link için. */
export function generateResponseToken(): string {
  return randomBytes(32).toString("base64url") // 256 bit, ~43 karakter
}

export type ResponseLinkFailureReason = "not_found" | "revoked" | "expired" | "audit_closed"

export type ResponseLinkValidation =
  | {
      ok: true
      link: { id: number; auditPlanEntryId: number; expiresAt: Date | null }
      entry: { id: number; status: string }
    }
  | { ok: false; reason: ResponseLinkFailureReason }

/**
 * Public route'ların HER isteğinde çağırması gereken tek doğrulama noktası:
 * token var mı → revoke edilmemiş mi → süresi geçmemiş mi → bağlı denetim
 * Completed/Cancelled değil mi. Bunlardan biri bile sağlanmazsa erişim reddedilir.
 */
export async function validateActiveResponseLink(token: string): Promise<ResponseLinkValidation> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, reason: "not_found" }

  const link = await prisma.auditResponseLink.findUnique({
    where: { token: trimmed },
    include: { entry: { select: { id: true, status: true } } },
  })
  if (!link) return { ok: false, reason: "not_found" }
  if (link.revokedAt) return { ok: false, reason: "revoked" }
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" }
  if (CLOSED_STATUSES.has(link.entry.status)) return { ok: false, reason: "audit_closed" }

  return {
    ok: true,
    link: { id: link.id, auditPlanEntryId: link.auditPlanEntryId, expiresAt: link.expiresAt },
    entry: { id: link.entry.id, status: link.entry.status },
  }
}

/**
 * Denetim Completed veya Cancelled durumuna geçtiğinde bu denetime bağlı tüm aktif
 * (henüz revoke edilmemiş) response link'leri otomatik iptal eder. Reopen bu fonksiyonu
 * ÇAĞIRMAZ — reaktivasyon her zaman yetkili kullanıcının açık bir işlemini gerektirir.
 */
export async function revokeActiveResponseLinksForEntry(auditPlanEntryId: number): Promise<void> {
  await prisma.auditResponseLink.updateMany({
    where: { auditPlanEntryId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function responseLinkReasonMessage(reason: ResponseLinkFailureReason): string {
  switch (reason) {
    case "not_found":
      return "Bu bağlantı geçersiz. Lütfen denetimi düzenleyen kişiyle iletişime geçin."
    case "revoked":
      return "Bu bağlantı devre dışı bırakılmış. Lütfen denetimi düzenleyen kişiyle iletişime geçin."
    case "expired":
      return "Bu bağlantının süresi dolmuş. Lütfen denetimi düzenleyen kişiyle iletişime geçin."
    case "audit_closed":
      return "Bu denetim tamamlanmış veya iptal edilmiş, bağlantı artık aktif değil."
    default:
      return "Bu bağlantı kullanılamıyor."
  }
}

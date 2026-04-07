/**
 * Audit Plan yalnızca yapılandırılmış yönetici e-postalarına açılır.
 * `.env.local` içinde virgülle ayrılmış liste:
 * `AUDIT_PLAN_ADMIN_EMAILS=admin@example.com,other@example.com`
 */
export function canAccessAuditPlan(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  const raw = process.env.AUDIT_PLAN_ADMIN_EMAILS?.trim()
  if (!raw) return false
  const normalized = email.trim().toLowerCase()
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(normalized)
}

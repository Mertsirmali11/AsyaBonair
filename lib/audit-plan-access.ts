/**
 * @deprecated Audit Plan (ve ilişkili Audit Findings / Audit Checklists / Audit Sessions /
 * User Groups audit kullanımı) yetkisi artık Configurations → Yetkilendirme ekranındaki
 * Department Permissions matrisi üzerinden çözülüyor:
 * `DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING` — bkz. lib/audit-plan-session.ts
 * `requireAuditPlanSession()` ve lib/require-department-permission.ts `hasDepartmentPermission()`.
 *
 * Bu fonksiyon ve `AUDIT_PLAN_ADMIN_EMAILS` env değişkeni artık hiçbir sayfa/menü/API
 * authorization kontrolünde kullanılmıyor (2026-08 refactor — bkz. ilgili PR). Geriye dönük
 * uyumluluk dışında bir amacı kalmadı; env değişkeni `.env`'den ve bu dosya güvenle
 * kaldırılabilir. Şimdilik bilinçli olarak siliniyor değil, yalnızca "artık kaynak değil"
 * diye işaretleniyor.
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

import "server-only"

import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { hasDepartmentPermission } from "@/lib/require-department-permission"

/**
 * Audit Plan modülünün (Audit Plan + Audit Checklists + Audit Sessions alt akışları) TEK
 * server-side yetki kapısı. Source of truth: Configurations → Yetkilendirme ekranındaki
 * Department Permissions matrisi — DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING.
 *
 * `AUDIT_PLAN_ADMIN_EMAILS` / canAccessAuditPlan() artık bu kapıda KULLANILMIYOR (bkz.
 * lib/audit-plan-access.ts üstündeki deprecation notu) — sayfa/menü tarafı zaten aynı
 * permission'a bağlıydı, API tarafı da buraya taşınarak tek kaynağa indirgendi.
 */
// `auth` NextAuth'ta overload'lu (session getter + middleware + route handler) — `typeof auth`
// üzerinden ReturnType almak yanlış overload'ı seçebiliyor. Argümansız çağrıyı sarmalayıp
// asıl "session getter" overload'ının dönüş tipini buradan çıkarıyoruz.
async function getAuthSession() {
  return auth()
}
type AuthSession = Awaited<ReturnType<typeof getAuthSession>>
/** `email` doğrulanmış (truthy) hale getirilmiş session — çağıranlar `session.user.email`i
 * ayrıca null kontrolü yapmadan kullanabilir. */
type AuditPlanSession = AuthSession & { user: NonNullable<AuthSession>["user"] & { email: string } }

export async function requireAuditPlanSession(): Promise<AuditPlanSession | null> {
  const session = await getAuthSession()
  if (!session?.user?.email) return null
  const allowed = await hasDepartmentPermission(
    session.user.departman,
    DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING
  )
  if (!allowed) return null
  return session as AuditPlanSession
}

import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"

export async function requireAuditPlanSession() {
  const session = await auth()
  if (!session?.user?.email || !canAccessAuditPlan(session.user.email)) {
    return null
  }
  return session
}

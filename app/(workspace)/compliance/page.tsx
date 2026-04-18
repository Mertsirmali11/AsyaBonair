import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { canAccessQualityOrAdminSettings } from "@/lib/department-access"

/** Eski Overview kaldırıldı; /compliance doğrudan uygun alt modüle yönlendirilir. */
export default async function ComplianceRootRedirect() {
  const session = await auth()
  if (!session) redirect("/login")

  if (canAccessAuditPlan(session.user?.email)) {
    redirect("/compliance/audit-plan")
  }
  if (canAccessQualityOrAdminSettings(session.user?.departman)) {
    redirect("/compliance/performance-reports")
  }

  redirect("/dashboard")
}

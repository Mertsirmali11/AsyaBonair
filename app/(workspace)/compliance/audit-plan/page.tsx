import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditPlanClient } from "@/components/compliance/audit-plan-client"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export default async function AuditPlanPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  // Allow: email whitelist OR Compliance Monitoring department permission
  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  const mayComplianceArea = permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]
  const mayAuditPlan = canAccessAuditPlan(session.user?.email)

  if (!mayComplianceArea && !mayAuditPlan) {
    redirect("/dashboard")
  }

  return <AuditPlanClient />
}

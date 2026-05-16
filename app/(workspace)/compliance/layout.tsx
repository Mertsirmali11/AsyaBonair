import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export default async function ComplianceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  const mayComplianceArea =
    permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]
  const mayAuditPlan = canAccessAuditPlan(session.user?.email)
  if (!mayComplianceArea && !mayAuditPlan) {
    redirect("/dashboard")
  }
  return <>{children}</>
}

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditPlanClient } from "@/components/compliance/audit-plan-client"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export default async function AuditPlanPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  // Source of truth: Configurations → Yetkilendirme ekranındaki Compliance Monitoring izni.
  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  const mayComplianceArea = permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]

  if (!mayComplianceArea) {
    redirect("/dashboard")
  }

  return <AuditPlanClient />
}

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditPlanClient } from "@/components/compliance/audit-plan-client"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

/**
 * Plansız Denetimler — mevcut Audit Plan motorunun (AuditPlanEntry + checklist/session/
 * finding/CPA/document/history) auditType="UNPLANNED" ile aynen kullanılan hali. Ayrı bir
 * audit engine YOK, bkz. components/compliance/audit-plan-client.tsx.
 * Yetki kaynağı /compliance/audit-plan ile BİREBİR AYNI (compliance_monitoring izni).
 */
export default async function UnplannedAuditsPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  const mayComplianceArea = permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]

  if (!mayComplianceArea) {
    redirect("/dashboard")
  }

  return <AuditPlanClient auditType="UNPLANNED" />
}

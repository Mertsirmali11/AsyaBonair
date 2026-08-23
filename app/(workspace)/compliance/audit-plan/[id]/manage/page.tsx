import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ManageAuditClient } from "@/components/compliance/manage-audit-client"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

type Props = { params: Promise<{ id: string }> }

export default async function ManageAuditPage({ params }: Props) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  // Aynı erişim kuralı: Audit Plan listesine bakabilen (Compliance Monitoring departman
  // izni) Manage Audit'i de görebilir.
  const permissions = await getResolvedDepartmentPermissionsForUser(session.user?.departman)
  const mayComplianceArea = permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]
  if (!mayComplianceArea) {
    redirect("/dashboard")
  }

  const { id } = await params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) {
    redirect("/compliance/audit-plan")
  }

  return <ManageAuditClient entryId={entryId} />
}

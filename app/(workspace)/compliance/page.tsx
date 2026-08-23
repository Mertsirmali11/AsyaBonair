import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

/** Eski Overview kaldırıldı; /compliance doğrudan uygun alt modüle yönlendirilir. */
export default async function ComplianceRootRedirect() {
  const session = await auth()
  if (!session) redirect("/login")

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
    redirect("/compliance/audit-plan")
  }

  redirect("/dashboard")
}

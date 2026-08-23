import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditChecklistsClient } from "@/components/compliance/audit-checklists-client"
import { DEPARTMENT_PERMISSION_KEYS, hasDepartmentPermission } from "@/lib/require-department-permission"

export default async function AuditChecklistsPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!(await hasDepartmentPermission(session.user?.departman, DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING))) {
    redirect("/dashboard")
  }

  return <AuditChecklistsClient />
}

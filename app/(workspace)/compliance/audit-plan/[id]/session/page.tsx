import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AuditSessionClient } from "@/components/compliance/audit-session-client"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

type Props = { params: Promise<{ id: string }> }

export default async function AuditSessionPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")
  const permissions = await getResolvedDepartmentPermissionsForUser(session.user?.departman)
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) redirect("/dashboard")

  const { id } = await params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) redirect("/compliance/audit-plan")

  return <AuditSessionClient auditPlanEntryId={entryId} />
}

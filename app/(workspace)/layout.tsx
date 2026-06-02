import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import {
  getResolvedDepartmentPermissionsForUser,
  type ResolvedDepartmentPermissions,
} from "@/lib/department-permissions-resolve"

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  // Show Audit Plan nav: email whitelist OR Compliance Monitoring department permission
  const permissions: ResolvedDepartmentPermissions =
    await getResolvedDepartmentPermissionsForUser(session.user?.departman)
  const showAuditPlanNav =
    canAccessAuditPlan(session.user?.email) ||
    permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]

  return (
    <DashboardLayout
      user={user}
      showAuditPlanNav={showAuditPlanNav}
      departmentPermissions={permissions}
    >
      {children}
    </DashboardLayout>
  )
}

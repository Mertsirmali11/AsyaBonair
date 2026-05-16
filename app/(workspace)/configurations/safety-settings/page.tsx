import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { SafetySettingsClient } from "@/components/safety-settings-client"
import { DEPARTMENT_PERMISSION_KEYS } from "@/lib/department-permission-keys"
import { getResolvedDepartmentPermissionsForUser } from "@/lib/department-permissions-resolve"

export default async function SafetySettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const permissions = await getResolvedDepartmentPermissionsForUser(
    session.user?.departman
  )
  if (!permissions[DEPARTMENT_PERMISSION_KEYS.COMPLIANCE_MONITORING]) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · Safety settings"
      pageTitle="Safety settings"
      breadcrumbCurrent="Safety settings"
    >
      <SafetySettingsClient />
    </ConfigurationsPageShell>
  )
}

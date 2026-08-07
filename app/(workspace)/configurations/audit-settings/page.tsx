import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigAuditSettingsClient } from "@/components/config-audit-settings-client"
import { NavPageTitle } from "@/components/nav-page-title"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function ConfigurationsAuditSettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (
    !(await hasDepartmentPermission(
      session.user?.departman,
      DEPARTMENT_PERMISSION_KEYS.CONFIGURATIONS_AREA
    ))
  ) {
    redirect("/dashboard")
  }

  return (
    <>
      <NavPageTitle navKeys={["configurations", "auditSettings"]} />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <ConfigAuditSettingsClient />
      </div>
    </>
  )
}

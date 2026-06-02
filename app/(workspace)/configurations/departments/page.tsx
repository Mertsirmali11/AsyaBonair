import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigDepartmentsClient } from "@/components/config-departments-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function ConfigurationsDepartmentsPage() {
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
    <ConfigurationsPageShell
      workspaceTitle="Yapılandırma · Departmanlar"
      pageTitle="Departmanlar"
      breadcrumbCurrent="Departmanlar"
    >
      <ConfigDepartmentsClient />
    </ConfigurationsPageShell>
  )
}

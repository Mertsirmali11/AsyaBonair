import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigUserGroupsClient } from "@/components/config-user-groups-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function ConfigurationsUserGroupsPage() {
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
      workspaceTitle="Yapılandırma · Kullanıcı Grupları"
      pageTitle="Kullanıcı Grupları"
      breadcrumbCurrent="Kullanıcı Grupları"
    >
      <ConfigUserGroupsClient />
    </ConfigurationsPageShell>
  )
}

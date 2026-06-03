import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigDepartmentPermissionsClient } from "@/components/config-department-permissions-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { DeptPermInfoTooltip } from "@/components/dept-perm-info-tooltip"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function ConfigurationsDepartmentPermissionsPage() {
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
      workspaceTitle="Yapılandırma · Yetkilendirme"
      pageTitle="Departman yetkileri"
      breadcrumbCurrent="Yetkilendirme"
      pageTitleAction={<DeptPermInfoTooltip />}
    >
      <ConfigDepartmentPermissionsClient />
    </ConfigurationsPageShell>
  )
}

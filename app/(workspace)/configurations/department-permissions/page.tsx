import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigDepartmentPermissionsClient } from "@/components/config-department-permissions-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsDepartmentPermissionsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Yapılandırma · Yetkilendirme"
      pageTitle="Departman yetkileri"
      breadcrumbCurrent="Yetkilendirme"
    >
      <ConfigDepartmentPermissionsClient />
    </ConfigurationsPageShell>
  )
}

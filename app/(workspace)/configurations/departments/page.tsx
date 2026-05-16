import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigDepartmentsClient } from "@/components/config-departments-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsDepartmentsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
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

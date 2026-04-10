import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigOutgoingCorrespondenceDeptsClient } from "@/components/config-outgoing-correspondence-depts-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsCorrespondencesPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · Correspondences"
      pageTitle="Correspondences"
      breadcrumbCurrent="Correspondences"
    >
      <ConfigOutgoingCorrespondenceDeptsClient />
    </ConfigurationsPageShell>
  )
}

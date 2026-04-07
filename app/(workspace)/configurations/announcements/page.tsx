import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigAnnouncementsClient } from "@/components/config-announcements-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsAnnouncementsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · Announcements"
      pageTitle="Announcements"
      breadcrumbCurrent="Announcements"
    >
      <ConfigAnnouncementsClient compactHeader />
    </ConfigurationsPageShell>
  )
}

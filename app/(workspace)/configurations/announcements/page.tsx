import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { ConfigAnnouncementsClient } from "@/components/config-announcements-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"

export default async function ConfigurationsAnnouncementsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <>
      <SetWorkspacePageTitle title="Configurations · Announcements" />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <ConfigAnnouncementsClient />
      </div>
    </>
  )
}

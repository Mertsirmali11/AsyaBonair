import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigAnnouncementsClient } from "@/components/config-announcements-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import {
  DEPARTMENT_PERMISSION_KEYS,
  hasDepartmentPermission,
} from "@/lib/require-department-permission"

export default async function ConfigurationsAnnouncementsPage() {
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
      workspaceTitle="Configurations · Announcements"
      pageTitle="Announcements"
      breadcrumbCurrent="Announcements"
    >
      <ConfigAnnouncementsClient compactHeader />
    </ConfigurationsPageShell>
  )
}

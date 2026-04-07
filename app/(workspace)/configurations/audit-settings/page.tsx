import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigAuditSettingsClient } from "@/components/config-audit-settings-client"
import { SetWorkspacePageTitle } from "@/components/workspace-page-title"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsAuditSettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <>
      <SetWorkspacePageTitle title="Configurations · Audit Settings" />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <ConfigAuditSettingsClient />
      </div>
    </>
  )
}

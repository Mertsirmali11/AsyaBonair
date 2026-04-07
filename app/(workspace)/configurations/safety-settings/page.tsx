import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { SafetySettingsClient } from "@/components/safety-settings-client"
import { canAccessQualityOrAdminSettings } from "@/lib/department-access"

export default async function SafetySettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessQualityOrAdminSettings(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · Safety settings"
      pageTitle="Safety settings"
      breadcrumbCurrent="Safety settings"
    >
      <SafetySettingsClient />
    </ConfigurationsPageShell>
  )
}

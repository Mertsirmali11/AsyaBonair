import dynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { canAccessConfigurationsArea } from "@/lib/department-access"

const UserManagement = dynamic(
  () => import("@/components/user-management").then((m) => ({ default: m.UserManagement })),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm">Loading pilot settings…</p>
    ),
  }
)

export default async function PilotSettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · Pilot settings"
      pageTitle="Pilot settings"
      breadcrumbCurrent="Pilot settings"
    >
      <UserManagement
        hidePageTitle
        departmentFilter="Pilot"
        title="Pilot Settings"
      />
    </ConfigurationsPageShell>
  )
}

import dynamic from "next/dynamic"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import {
  canAccessConfigurationsArea,
  isAdminDepartment,
} from "@/lib/department-access"

const UserManagement = dynamic(
  () => import("@/components/user-management").then((m) => ({ default: m.UserManagement })),
  {
    loading: () => (
      <p className="text-muted-foreground text-sm">Loading user settings…</p>
    ),
  }
)

export default async function ConfigurationsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · User settings"
      pageTitle="User settings"
      breadcrumbCurrent="User settings"
    >
      <UserManagement
        hidePageTitle
        title="User Settings"
        isAdminViewer={isAdminDepartment(session.user?.departman)}
      />
    </ConfigurationsPageShell>
  )
}

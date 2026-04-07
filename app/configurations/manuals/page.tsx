import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigManualsClient } from "@/components/config-manuals-client"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { DashboardLayout } from "@/components/dashboard-layout"
import { canAccessConfigurationsArea } from "@/lib/department-access"

export default async function ConfigurationsManualsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canAccessConfigurationsArea(session.user?.departman)) {
    redirect("/dashboard")
  }

  const user = {
    name: session.user?.name || "User",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user}>
      <ConfigurationsPageShell
        workspaceTitle="Configurations · AI manuals"
        pageTitle="AI manuals"
        breadcrumbCurrent="AI manuals"
      >
        <ConfigManualsClient />
      </ConfigurationsPageShell>
    </DashboardLayout>
  )
}

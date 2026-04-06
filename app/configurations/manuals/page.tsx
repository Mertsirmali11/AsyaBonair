import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { ConfigManualsClient } from "@/components/config-manuals-client"
import { DashboardLayout } from "@/components/dashboard-layout"

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
    <DashboardLayout user={user} headerTitle="Configurations · AI manuals">
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <ConfigManualsClient />
      </div>
    </DashboardLayout>
  )
}

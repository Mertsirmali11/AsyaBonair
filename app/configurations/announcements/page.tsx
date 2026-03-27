import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { ConfigAnnouncementsClient } from "@/components/config-announcements-client"
import { DashboardLayout } from "@/components/dashboard-layout"

export default async function ConfigurationsAnnouncementsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

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
    <DashboardLayout user={user} headerTitle="Configurations · Announcements">
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <ConfigAnnouncementsClient />
      </div>
    </DashboardLayout>
  )
}

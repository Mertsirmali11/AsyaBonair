import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AircraftSettingsTable } from "@/components/aircraft-settings-table"

export default async function AircraftSettingsPage() {
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
      <div className="flex flex-col gap-6 p-6">
        <AircraftSettingsTable />
      </div>
    </DashboardLayout>
  )
}
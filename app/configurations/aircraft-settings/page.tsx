import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AircraftSettingsTable } from "@/components/aircraft-settings-table"

export default async function AircraftSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userDepartman = session.user?.departman
  if (userDepartman !== "Human Resources" && userDepartman !== "Quality") {
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Aircraft Settings</h2>
          </div>
          <AircraftSettingsTable />
        </div>
      </div>
    </DashboardLayout>
  )
}
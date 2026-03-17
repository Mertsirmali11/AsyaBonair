import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { UserManagement } from "@/components/user-management"

export default async function PilotSettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Check department access - only Human Resources or Quality can access
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
        {/* Pilot Management Section - Only shows users with Pilot department */}
        <UserManagement departmentFilter="Pilot" title="Pilot Settings" />
      </div>
    </DashboardLayout>
  )
}


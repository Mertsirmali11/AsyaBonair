import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { HazardReportManagement } from "@/components/hazard-report-management"

export default async function HazardInboxPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
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
        {/* Hazard Report Management Section */}
        <HazardReportManagement />
      </div>
    </DashboardLayout>
  )
}


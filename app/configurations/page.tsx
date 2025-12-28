import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { UserManagement } from "@/components/user-management"

export default async function ConfigurationsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Check department access - only Administrative Affairs can access
  if (session.user?.departman !== "Administrative Affairs") {
    redirect("/dashboard")
  }

  const user = {
    name: session.user?.name || "Kullanıcı",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h1 className="text-lg font-medium text-muted-foreground">
            Configurations
          </h1>
        </div>

        {/* User Management Section */}
        <UserManagement />
      </div>
    </DashboardLayout>
  )
}

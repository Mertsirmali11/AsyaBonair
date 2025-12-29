import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardLayout } from "@/components/dashboard-layout"
import { UserManagement } from "@/components/user-management"
import Image from "next/image"

export default async function ConfigurationsPage() {
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
    name: session.user?.name || "Kullanıcı",
    email: session.user?.email || "",
    avatar: session.user?.image || "",
    departman: session.user?.departman || null,
  }

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
              <Image
                src="/logo.png"
                alt="Bonair Logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                unoptimized
              />
            </div>
            <h1 className="text-lg font-medium text-muted-foreground">
              Configurations
            </h1>
          </div>
        </div>

        {/* User Management Section */}
        <UserManagement title="User Settings" />
      </div>
    </DashboardLayout>
  )
}

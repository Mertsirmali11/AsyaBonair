import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { DashboardLayout } from "@/components/dashboard-layout"
import { IncomingCorrespondencesTable } from "@/components/incoming-correspondences-table"

export default async function IncomingCorrespondencesPage() {
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
    <DashboardLayout user={user} headerTitle="Incoming Correspondences">
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <IncomingCorrespondencesTable userId={session.user?.id ?? ""} />
      </div>
    </DashboardLayout>
  )
}

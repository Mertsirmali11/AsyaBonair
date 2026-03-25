import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessConfigurationsArea } from "@/lib/department-access"
import { DashboardLayout } from "@/components/dashboard-layout"
import { OutgoingCorrespondenceForm } from "@/components/outgoing-correspondence-form"
import { OutgoingCorrespondencesTable } from "@/components/outgoing-correspondences-table"

export default async function OutgoingCorrespondencesPage() {
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
    <DashboardLayout user={user} headerTitle="Outgoing Correspondences">
      <div className="flex flex-1 flex-col p-6">
        <OutgoingCorrespondenceForm userId={session.user?.id || ""} />
        
        <div className="mt-8">
          <OutgoingCorrespondencesTable />
        </div>
      </div>
    </DashboardLayout>
  )
}

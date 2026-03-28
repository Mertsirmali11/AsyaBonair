import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canApproveWorkerRegistrations } from "@/lib/department-access"
import { DashboardLayout } from "@/components/dashboard-layout"
import { WorkerRegistrationsPanel } from "@/components/worker-registrations-panel"

export default async function NewWorkerRegistrationsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canApproveWorkerRegistrations(session.user?.departman)) {
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
        <WorkerRegistrationsPanel />
      </div>
    </DashboardLayout>
  )
}

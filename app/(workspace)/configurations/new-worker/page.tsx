import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canApproveWorkerRegistrations } from "@/lib/department-access"
import { WorkerRegistrationsPanel } from "@/components/worker-registrations-panel"

export default async function NewWorkerRegistrationsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canApproveWorkerRegistrations(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <WorkerRegistrationsPanel />
    </div>
  )
}

import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { ConfigurationsPageShell } from "@/components/configurations-page-shell"
import { WorkerRegistrationsPanel } from "@/components/worker-registrations-panel"
import { canApproveWorkerRegistrations } from "@/lib/department-access"

export default async function NewWorkerRegistrationsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!canApproveWorkerRegistrations(session.user?.departman)) {
    redirect("/dashboard")
  }

  return (
    <ConfigurationsPageShell
      workspaceTitle="Configurations · New worker"
      pageTitle="New worker registrations"
      breadcrumbCurrent="New worker"
    >
      <WorkerRegistrationsPanel embedded />
    </ConfigurationsPageShell>
  )
}

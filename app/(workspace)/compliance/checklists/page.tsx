import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditChecklistsClient } from "@/components/compliance/audit-checklists-client"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"

export default async function AuditChecklistsPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!canAccessAuditPlan(session.user?.email)) {
    redirect("/dashboard")
  }

  return <AuditChecklistsClient />
}

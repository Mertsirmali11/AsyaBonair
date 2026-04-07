import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuditPlanClient } from "@/components/compliance/audit-plan-client"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"

export default async function AuditPlanPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!canAccessAuditPlan(session.user?.email)) {
    redirect("/dashboard")
  }

  return <AuditPlanClient />
}

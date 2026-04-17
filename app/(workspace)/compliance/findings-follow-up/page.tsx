import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { FindingsFollowUpClient } from "@/components/compliance/findings-follow-up-client"

export default async function FindingsFollowUpPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canAccessAuditPlan(session.user?.email)) redirect("/dashboard")

  return <FindingsFollowUpClient />
}

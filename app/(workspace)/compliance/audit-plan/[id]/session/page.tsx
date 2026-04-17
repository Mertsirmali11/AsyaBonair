import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { AuditSessionClient } from "@/components/compliance/audit-session-client"

type Props = { params: Promise<{ id: string }> }

export default async function AuditSessionPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canAccessAuditPlan(session.user?.email)) redirect("/dashboard")

  const { id } = await params
  const entryId = Number(id)
  if (!Number.isInteger(entryId) || entryId < 1) redirect("/compliance/audit-plan")

  return <AuditSessionClient auditPlanEntryId={entryId} />
}

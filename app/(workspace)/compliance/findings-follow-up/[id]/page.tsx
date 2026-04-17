import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { canAccessAuditPlan } from "@/lib/audit-plan-access"
import { FindingDetailClient } from "@/components/compliance/finding-detail-client"

type Props = { params: Promise<{ id: string }> }

export default async function FindingDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canAccessAuditPlan(session.user?.email)) redirect("/dashboard")

  const { id } = await params
  const findingId = Number(id)
  if (!Number.isInteger(findingId) || findingId < 1) redirect("/compliance/findings-follow-up")

  return <FindingDetailClient findingId={findingId} />
}
